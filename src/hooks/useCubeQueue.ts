import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AnimationService } from '../animation/AnimationService';
import { EasedAnimation } from '../animation/EasedAnimation';
import { MoveAnimation } from '../animation/MoveAnimation';
import { easeInOutCubic } from '../animation/easing';
import { createSolvedCube } from '../model/cube';
import { INVERSE_MOVE, MOVE_SPECS, applyMoveToModel, getAffectedIndices } from '../model/moves';
import type { MoveId } from '../model/moves';
import type { CubeModel } from '../types/cube';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const MOVE_DURATION_MS = 320;

// --------------------------------------------------------------------------
// Action type
// --------------------------------------------------------------------------

/**
 * A serialised unit of work that the queue can execute in order.
 *
 *   move   — animate a face/cube rotation and commit it to history
 *   undo   — invert the last committed move (no-op if nothing to undo)
 *   redo   — replay the next move in the redo stack (no-op if none)
 *   effect — synchronous side-effect (e.g. logging); runs between animations
 *            without adding any delay
 */
export type CubeAction =
  | { kind: 'move'; move: MoveId }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'effect'; fn: () => void };

// --------------------------------------------------------------------------
// Return type
// --------------------------------------------------------------------------

export interface CubeQueue {
  // ── Visible state (for rendering / UI) ───────────────────────────────────
  /** Current cube model — passed directly to CubeRenderer. */
  cube: CubeModel;
  /** How many forward moves have been applied (position in history). */
  historyIndex: number;
  /** Total moves in the history array (historyIndex..totalMoves is the redo stack). */
  totalMoves: number;
  /** Items in the queue that haven't started animating yet. */
  pendingCount: number;
  /** True while an animation is running or items are pending. */
  isBusy: boolean;

  // ── Operations ────────────────────────────────────────────────────────────
  /**
   * Append one or more actions to the tail of the queue.
   * The queue drains automatically in the background.
   */
  dispatch: (...actions: CubeAction[]) => void;
  /** Drop all pending (not yet started) queue items. */
  cancel: () => void;
  /** Reset cube to solved state and clear all history and the queue. */
  resetCube: () => void;
  /**
   * Return the committed cube model as of the last completed animation.
   * Use this to compute a solver solution from the current logical state
   * rather than the (possibly lagging) React cube state.
   */
  getCommittedCube: () => CubeModel;
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

export function useCubeQueue(animService: AnimationService): CubeQueue {
  // ── Visible React state ───────────────────────────────────────────────────
  const [cube, setCube] = useState<CubeModel>(createSolvedCube);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const isBusy = isAnimating || pendingCount > 0;

  // ── Committed state (synchronous — always one render ahead) ───────────────
  //
  // committedCubeRef  — the post-move CubeModel; updated synchronously in
  //   animation onDone callbacks so the *next* animation always reads correct
  //   block positions, even before React has flushed the setCube() call.
  //
  // histRef           — mirrors historyIndex / totalMoves but is never stale;
  //   animation callbacks read it directly without waiting for re-renders.
  //
  // queueRef          — the mutable action queue (plain array mutation avoids
  //   stale-closure problems that would arise with useState).
  //
  // isProcessingRef   — true while the drain loop is running; guards the
  //   background-trigger effect from starting a second concurrent drain.
  //
  // generationRef     — bumped by resetCube(); lets animation callbacks detect
  //   that a reset happened mid-flight and silently discard their results.

  const histRef = useRef<{ moves: MoveId[]; index: number }>({ moves: [], index: 0 });
  const queueRef = useRef<CubeAction[]>([]);
  const isProcessingRef = useRef(false);
  const generationRef = useRef(0);

  const committedCubeRef = useRef(cube);
  // When idle, keep committedCubeRef in sync so drag-rotation changes are
  // visible to the next animation.  During processing we must NOT sync from
  // cube because React's setCube has not flushed the latest committed blocks.
  if (!isProcessingRef.current) committedCubeRef.current = cube;

  // ── Core animation helper ─────────────────────────────────────────────────
  /**
   * Submit a single move animation to the AnimationService.
   *
   * Eagerly computes both the affected block indices and the post-move model
   * so the next queued action can immediately read correct state without
   * waiting for a React render.
   *
   * All callbacks are guarded by `generationRef`: if `resetCube()` fires
   * while the animation is in-flight, the callbacks become no-ops and the
   * drain loop is not advanced.
   */
  const runMoveAnimation = useCallback(
    (move: MoveId, currentModel: CubeModel, onDone: (committed: CubeModel) => void) => {
      const { axis, angle } = MOVE_SPECS[move];
      const targetRotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      const affectedIndices = getAffectedIndices(currentModel.blocks, move);
      const committedModel = applyMoveToModel(currentModel, move);
      const gen = generationRef.current;

      // Wrap setCube so that visual updates from stale animations are dropped.
      const guardedSetCube = (fn: (prev: CubeModel) => CubeModel) => {
        if (generationRef.current === gen) setCube(fn);
      };

      animService.submit(
        new EasedAnimation(
          new MoveAnimation(affectedIndices, targetRotation, guardedSetCube, committedModel, (c) => {
            if (generationRef.current === gen) onDone(c);
          }),
          easeInOutCubic,
        ),
        MOVE_DURATION_MS,
      );
    },
    [],
  );

  // ── Queue drain ───────────────────────────────────────────────────────────
  /**
   * Pop the next action and execute it.  Calls itself recursively (via
   * animation callbacks or directly for synchronous actions) until the queue
   * is drained.
   *
   * Rules:
   *   effect  — run fn() synchronously, then drain immediately (no delay)
   *   move    — trim redo stack, animate, then drain on commit
   *   undo    — animate the inverse move, then drain on commit;
   *             skips silently if there is nothing to undo
   *   redo    — animate the forward move, then drain on commit;
   *             skips silently if there is nothing to redo
   */
  const drain = useCallback(() => {
    if (queueRef.current.length === 0) {
      isProcessingRef.current = false;
      setIsAnimating(false);
      return;
    }

    const [action, ...rest] = queueRef.current;
    queueRef.current = rest;
    setPendingCount(rest.length);

    switch (action.kind) {
      case 'effect': {
        action.fn();
        drain();
        return;
      }

      case 'move': {
        // A new forward move invalidates the redo stack.
        if (histRef.current.index < histRef.current.moves.length) {
          const trimmed = histRef.current.moves.slice(0, histRef.current.index);
          histRef.current = { moves: trimmed, index: histRef.current.index };
          setTotalMoves(trimmed.length);
        }
        setIsAnimating(true);
        runMoveAnimation(action.move, committedCubeRef.current, (committed) => {
          committedCubeRef.current = committed;
          const newMoves = [...histRef.current.moves, action.move];
          histRef.current = { moves: newMoves, index: newMoves.length };
          setHistoryIndex(newMoves.length);
          setTotalMoves(newMoves.length);
          drain();
        });
        return;
      }

      case 'undo': {
        const { index, moves } = histRef.current;
        if (index === 0) {
          drain(); // nothing to undo — skip silently
          return;
        }
        setIsAnimating(true);
        runMoveAnimation(INVERSE_MOVE[moves[index - 1]], committedCubeRef.current, (committed) => {
          committedCubeRef.current = committed;
          histRef.current = { ...histRef.current, index: histRef.current.index - 1 };
          setHistoryIndex(histRef.current.index);
          drain();
        });
        return;
      }

      case 'redo': {
        const { index, moves } = histRef.current;
        if (index >= moves.length) {
          drain(); // nothing to redo — skip silently
          return;
        }
        setIsAnimating(true);
        runMoveAnimation(moves[index], committedCubeRef.current, (committed) => {
          committedCubeRef.current = committed;
          histRef.current = { ...histRef.current, index: histRef.current.index + 1 };
          setHistoryIndex(histRef.current.index);
          drain();
        });
        return;
      }
    }
  }, [runMoveAnimation]);

  // ── Background drain trigger ──────────────────────────────────────────────
  // Watches pendingCount.  Whenever items appear in the queue and no drain is
  // already running, starts one.  This decouples dispatch() from drain
  // management: callers only push to the queue.
  useEffect(() => {
    if (pendingCount > 0 && !isProcessingRef.current) {
      isProcessingRef.current = true;
      drain();
    }
  }, [pendingCount, drain]);

  // ── Public interface ──────────────────────────────────────────────────────
  const dispatch = useCallback((...actions: CubeAction[]) => {
    queueRef.current = [...queueRef.current, ...actions];
    setPendingCount(queueRef.current.length);
  }, []);

  const cancel = useCallback(() => {
    queueRef.current = [];
    setPendingCount(0);
  }, []);

  const resetCube = useCallback(() => {
    // Increment generation first so that any in-flight animation callbacks
    // detect the reset and become no-ops (guarded in runMoveAnimation).
    generationRef.current += 1;
    // Stop the service: this synchronously calls onEnd() on all live
    // animations.  Because of the generation guard, none of them will
    // update committed state or advance the drain loop.
    animService.stop();
    animService.start();

    queueRef.current = [];
    isProcessingRef.current = false;
    histRef.current = { moves: [], index: 0 };
    const solved = createSolvedCube();
    committedCubeRef.current = solved;
    setCube(solved);
    setHistoryIndex(0);
    setTotalMoves(0);
    setPendingCount(0);
    setIsAnimating(false);
  }, []);

  const getCommittedCube = useCallback(() => committedCubeRef.current, []);

  return {
    cube,
    historyIndex,
    totalMoves,
    pendingCount,
    isBusy,
    dispatch,
    cancel,
    resetCube,
    getCommittedCube,
  };
}
