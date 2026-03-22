import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimationService } from './animation/AnimationService';
import { EasedAnimation } from './animation/EasedAnimation';
import { MoveAnimation } from './animation/MoveAnimation';
import { RotationAnimation } from './animation/RotationAnimation';
import { easeInOutCubic } from './animation/easing';
import CubeRenderer from './components/CubeRenderer';
import { createSolvedCube } from './model/cube';
import {
  ALL_MOVES,
  INVERSE_MOVE,
  MOVE_PAIRS,
  MOVE_SPECS,
  applyMoveToModel,
  getAffectedIndices,
} from './model/moves';
import type { MoveId } from './model/moves';
import type { CubeModel } from './types/cube';

const MOVE_DURATION_MS = 320;
const RESET_DURATION_MS = 700;
const SCRAMBLE_MOVES = 50;

/**
 * Keyboard → MoveId mapping.
 * Lowercase letter = CW move, uppercase (Shift+letter) = CCW (prime) move.
 */
const HOTKEYS: Record<string, MoveId> = {
  f: 'F',
  F: "F'",
  b: 'B',
  B: "B'",
  r: 'R',
  R: "R'",
  l: 'L',
  L: "L'",
  u: 'U',
  U: "U'",
  d: 'D',
  D: "D'",
};

// Face accent colors for move buttons.
const FACE_COLOR: Record<string, string> = {
  R: '#b71234',
  L: '#ff5800',
  U: '#ffffff',
  D: '#ffd500',
  F: '#009b48',
  B: '#0046ad',
};

// --------------------------------------------------------------------------
// Small presentational components
// --------------------------------------------------------------------------

interface MovePairProps {
  cw: MoveId;
  ccw: MoveId;
  onMove: (id: MoveId) => void;
}

function MovePair({ cw, ccw, onMove }: MovePairProps) {
  const face = cw.replace("'", '');
  const accent = FACE_COLOR[face] ?? '#888';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      {[cw, ccw].map((id) => (
        <button
          key={id}
          onClick={() => onMove(id)}
          style={{ ...moveBtnBase, borderColor: accent, color: accent }}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// App
// --------------------------------------------------------------------------

export default function App() {
  const [cube, setCube] = useState<CubeModel>(createSolvedCube);

  // ── Animation state ──────────────────────────────────────────────────────
  // isAnimating: a move animation is currently in flight.
  // queueLength: moves waiting behind the current one.
  const [isAnimating, setIsAnimating] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const isBusy = isAnimating || queueLength > 0;

  // ── History ──────────────────────────────────────────────────────────────
  const [moves, setMoves] = useState<MoveId[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const canUndo = historyIndex > 0 && !isBusy;
  const canRedo = historyIndex < moves.length && !isBusy;

  // ── Refs ─────────────────────────────────────────────────────────────────
  const animService = useRef(new AnimationService());
  const cubeRef = useRef(cube);
  cubeRef.current = cube;

  // Mutable queue — accessed synchronously inside animation callbacks.
  const moveQueueRef = useRef<MoveId[]>([]);
  // True while any move is in-flight or enqueued; prevents re-truncating the
  // redo stack mid-batch and avoids spurious drain starts.
  const isProcessingRef = useRef(false);
  // Snapshot of historyIndex readable synchronously (state lags one render).
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;
  // The fully-committed cube state, kept one step ahead of React's cube state.
  // React's setCube is async; by the time drainQueue starts the next animation,
  // cubeRef.current still holds the pre-commit state.  committedModelRef is
  // updated synchronously in each move's onComplete, so getAffectedIndices
  // always sees the correct block positions for the upcoming move.
  const committedModelRef = useRef(cube);
  // Only sync blocks/faceColors changes — rotation changes don't affect moves.
  if (!isProcessingRef.current) committedModelRef.current = cube;

  // isBusy snapshot for keydown handler (avoids re-registering every render).
  const isBusyRef = useRef(isBusy);
  isBusyRef.current = isBusy;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const service = animService.current;
    service.start();
    return () => service.stop();
  }, []);

  // ── Core animation helper ─────────────────────────────────────────────────
  /**
   * Submit one move animation.
   * `currentModel` is the committed cube state to animate FROM (used to derive
   * affected block indices and to compute the post-move model).
   * `onDone` is called with the new committed model once the animation ends.
   */
  const runMoveAnimation = useCallback(
    (move: MoveId, currentModel: CubeModel, onDone: (committed: CubeModel) => void) => {
      const { axis, angle } = MOVE_SPECS[move];
      const targetRotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      // Compute both the affected indices AND the final committed model eagerly,
      // before the animation starts.  This avoids reading stale React state later.
      const affectedIndices = getAffectedIndices(currentModel.blocks, move);
      const committedModel = applyMoveToModel(currentModel, move);

      animService.current.submit(
        new EasedAnimation(
          new MoveAnimation(affectedIndices, targetRotation, setCube, committedModel, onDone),
          easeInOutCubic,
        ),
        MOVE_DURATION_MS,
      );
    },
    [],
  );

  // ── Queue drain ───────────────────────────────────────────────────────────
  /**
   * Pop the next move from the queue and animate it.
   * `recordMove` is called after each move commits so the caller decides
   * how to update history (forward move vs undo vs redo).
   */
  const drainQueue = useCallback(
    (recordMove: (m: MoveId) => void) => {
      if (moveQueueRef.current.length === 0) {
        isProcessingRef.current = false;
        setIsAnimating(false);
        return;
      }

      const [move, ...rest] = moveQueueRef.current;
      moveQueueRef.current = rest;
      setQueueLength(rest.length);
      setIsAnimating(true);

      runMoveAnimation(move, committedModelRef.current, (committed) => {
        committedModelRef.current = committed;
        recordMove(move);
        drainQueue(recordMove);
      });
    },
    [runMoveAnimation],
  );

  // ── Public move handlers ──────────────────────────────────────────────────
  const handleMove = useCallback(
    (move: MoveId) => {
      moveQueueRef.current = [...moveQueueRef.current, move];
      setQueueLength(moveQueueRef.current.length);

      if (!isProcessingRef.current) {
        isProcessingRef.current = true;
        // Truncate redo stack once at the start of each new forward batch.
        const idx = historyIndexRef.current;
        setMoves((prev) => prev.slice(0, idx));
        drainQueue((m) => {
          setMoves((prev) => [...prev, m]);
          setHistoryIndex((i) => i + 1);
        });
      }
    },
    [drainQueue],
  );

  const handleUndo = useCallback(() => {
    if (historyIndex === 0 || isBusy) return;
    const move = moves[historyIndex - 1];
    isProcessingRef.current = true;
    setIsAnimating(true);
    runMoveAnimation(INVERSE_MOVE[move], committedModelRef.current, (committed) => {
      committedModelRef.current = committed;
      setIsAnimating(false);
      isProcessingRef.current = false;
      setHistoryIndex((i) => i - 1);
    });
  }, [runMoveAnimation, moves, historyIndex, isBusy]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= moves.length || isBusy) return;
    const move = moves[historyIndex];
    isProcessingRef.current = true;
    setIsAnimating(true);
    runMoveAnimation(move, committedModelRef.current, (committed) => {
      committedModelRef.current = committed;
      setIsAnimating(false);
      isProcessingRef.current = false;
      setHistoryIndex((i) => i + 1);
    });
  }, [runMoveAnimation, moves, historyIndex, isBusy]);

  // ── Camera rotation ───────────────────────────────────────────────────────
  const handleRotate = useCallback((q: THREE.Quaternion) => {
    setCube((prev) => ({ ...prev, rotation: q }));
  }, []);

  const handleReset = useCallback(() => {
    const from = cubeRef.current.rotation.clone();
    animService.current.submit(
      new EasedAnimation(
        new RotationAnimation(from, new THREE.Quaternion(), (q) => {
          setCube((p) => ({ ...p, rotation: q }));
        }),
        easeInOutCubic,
      ),
      RESET_DURATION_MS,
    );
  }, []);

  const handleScramble = useCallback(() => {
    for (let i = 0; i < SCRAMBLE_MOVES; i++) {
      handleMove(ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)]);
    }
  }, [handleMove]);

  const handleResetCube = useCallback(() => {
    moveQueueRef.current = [];
    isProcessingRef.current = false;
    const solved = createSolvedCube();
    committedModelRef.current = solved;
    setCube(solved);
    setMoves([]);
    setHistoryIndex(0);
    setQueueLength(0);
    setIsAnimating(false);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        // Undo / redo are blocked while busy.
        if (isBusyRef.current) return;
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (e.key === 'z' && e.shiftKey) {
          e.preventDefault();
          handleRedo();
          return;
        }
        if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
        return;
      }

      if (e.key === 'Escape') {
        moveQueueRef.current = [];
        setQueueLength(0);
        return;
      }

      // Move keys are always accepted — they get enqueued if busy.
      const move = HOTKEYS[e.key];
      if (move) {
        e.preventDefault();
        handleMove(move);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleMove, handleUndo, handleRedo]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={headerStyle}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em', flex: 1 }}>
          Rubik&rsquo;s Cube
        </h1>
        <span style={{ fontSize: '0.8rem', color: '#8899aa', fontFamily: 'monospace' }}>
          {historyIndex}/{moves.length}
          {queueLength > 0 && ` +${queueLength}`}
        </span>
        <button onClick={handleUndo} disabled={!canUndo} style={iconBtnStyle}>
          ↩ Undo
        </button>
        <button onClick={handleRedo} disabled={!canRedo} style={iconBtnStyle}>
          Redo ↪
        </button>
        <button onClick={handleScramble} style={resetBtnStyle}>
          Scramble
        </button>
        <button onClick={handleResetCube} style={resetBtnStyle}>
          Reset
        </button>
        <button onClick={handleReset} style={resetBtnStyle}>
          Reset rotation
        </button>
      </header>

      <main style={mainGridStyle}>
        {/* Row 1 */}
        <div />
        <div style={centreSlot}>
          <MovePair cw="U" ccw="U'" onMove={handleMove} />
        </div>
        <div />

        {/* Row 2 */}
        <div style={centreSlot}>
          <MovePair cw="L" ccw="L'" onMove={handleMove} />
        </div>
        <CubeRenderer model={cube} onRotate={handleRotate} />
        <div style={centreSlot}>
          <MovePair cw="R" ccw="R'" onMove={handleMove} />
        </div>

        {/* Row 3 – F bottom-left, D centre, B bottom-right */}
        <div style={centreSlot}>
          <MovePair cw="F" ccw="F'" onMove={handleMove} />
        </div>
        <div style={centreSlot}>
          <MovePair cw="D" ccw="D'" onMove={handleMove} />
        </div>
        <div style={centreSlot}>
          <MovePair cw="B" ccw="B'" onMove={handleMove} />
        </div>
      </main>
    </div>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const headerStyle: React.CSSProperties = {
  padding: '10px 24px',
  background: '#16213e',
  borderBottom: '1px solid #0f3460',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  userSelect: 'none',
};

const mainGridStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '64px 1fr 64px',
  gridTemplateRows: '56px 1fr 56px',
  overflow: 'hidden',
};

const centreSlot: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const moveBtnBase: React.CSSProperties = {
  width: 44,
  padding: '4px 0',
  fontSize: '0.8rem',
  fontWeight: 700,
  fontFamily: 'monospace',
  background: 'transparent',
  border: '1px solid',
  borderRadius: 4,
  cursor: 'pointer',
  userSelect: 'none',
};

const iconBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '0.85rem',
  fontWeight: 500,
  background: 'transparent',
  color: '#aac',
  border: '1px solid #2a3a5a',
  borderRadius: 4,
  cursor: 'pointer',
};

const resetBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '0.85rem',
  fontWeight: 500,
  background: '#0f3460',
  color: '#eee',
  border: '1px solid #1a5276',
  borderRadius: 4,
  cursor: 'pointer',
};

// Suppress unused-variable warning for MOVE_PAIRS (exported for potential future use).
void MOVE_PAIRS;
