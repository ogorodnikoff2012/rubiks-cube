import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AppHeader from './components/AppHeader';
import CubeLayout from './components/CubeLayout';
import { AnimationService } from './animation/AnimationService';
import { EasedAnimation } from './animation/EasedAnimation';
import { RotationAnimation } from './animation/RotationAnimation';
import { easeInOutCubic } from './animation/easing';
import { solveLayerByLayer } from './solver/layerByLayer';
import { FACE_MOVES } from './model/moves';
import type { MoveId } from './model/moves';
import { useCubeQueue } from './hooks/useCubeQueue';
import type { CubeAction } from './hooks/useCubeQueue';
import { useIsMobile } from './hooks/useIsMobile';
import { DEFAULT_THEME } from './themes/themes';
import type { Theme } from './themes/themes';

const SCRAMBLE_MOVES = 50;

const INITIAL_ROTATION = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, -0.52, 0));
const RESET_ROTATION_MS = 700;

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
  x: 'x',
  X: "x'",
  y: 'y',
  Y: "y'",
  z: 'z',
  Z: "z'",
};

export default function App() {
  // ── Animation service ─────────────────────────────────────────────────────
  const animService = useRef(new AnimationService()).current;
  useEffect(() => {
    animService.start();
    return () => animService.stop();
  }, [animService]);

  const queue = useCubeQueue(animService);
  const { dispatch, cancel, isBusy } = queue;

  // ── Whole-cube visual rotation (renderer-only, not part of CubeModel) ─────
  //
  // Pure ref — no React state.  The renderer's RAF loop reads it every frame
  // and applies it to the Three.js group, so any mutation is picked up
  // immediately without going through React at all.
  //
  // Drag updates it directly inside CubeRenderer.
  // resetRotation animates it via RotationAnimation whose callback mutates it.
  const rotationRef = useRef(INITIAL_ROTATION.clone());

  const isMobile = useIsMobile();
  const isPortrait = useIsMobile(0); // max-width:0 never matches → only aspect-ratio clause fires

  const handleResetRotation = useCallback(() => {
    animService.submit(
      new EasedAnimation(
        new RotationAnimation(rotationRef.current.clone(), INITIAL_ROTATION.clone(), (q) => {
          rotationRef.current = q;
        }),
        easeInOutCubic,
      ),
      RESET_ROTATION_MS,
    );
  }, [animService]);

  const canUndo = queue.historyIndex > 0 && !isBusy;
  const canRedo = queue.historyIndex < queue.totalMoves && !isBusy;

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  // ── Solver panel ─────────────────────────────────────────────────────────
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [solverLog, setSolverLog] = useState<string[]>([]);

  // ── Move helpers ──────────────────────────────────────────────────────────
  const move = useCallback((id: MoveId) => dispatch({ kind: 'move', move: id }), [dispatch]);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    dispatch({ kind: 'undo' });
  }, [canUndo, dispatch]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    dispatch({ kind: 'redo' });
  }, [canRedo, dispatch]);

  const handleScramble = () => {
    const actions: CubeAction[] = [];
    let lastFace: string | null = null;
    for (let i = 0; i < SCRAMBLE_MOVES; i++) {
      const pool = FACE_MOVES.filter((m) => m.replace("'", '') !== lastFace);
      const scrambleMove = pool[Math.floor(Math.random() * pool.length)];
      lastFace = scrambleMove.replace("'", '');
      actions.push({ kind: 'move', move: scrambleMove });
    }
    queue.dispatch(...actions);
  };

  const handleSolve = () => {
    setIsPanelOpen(true);
    setSolverLog([]);

    const steps = solveLayerByLayer(queue.getCommittedCube());
    const actions: CubeAction[] = [];

    for (const { label, moves: stepMoves } of steps) {
      const capturedLabel = label;
      actions.push({ kind: 'effect', fn: () => setSolverLog((prev) => [...prev, capturedLabel]) });

      if (stepMoves.length === 0) {
        actions.push({
          kind: 'effect',
          fn: () => setSolverLog((prev) => [...prev, '  (already correct)']),
        });
      } else {
        for (const stepMove of stepMoves) {
          actions.push({ kind: 'move', move: stepMove });
          const capturedMove = stepMove;
          actions.push({
            kind: 'effect',
            fn: () => setSolverLog((prev) => [...prev, `  ${capturedMove}`]),
          });
        }
      }
    }

    actions.push({ kind: 'effect', fn: () => setSolverLog((prev) => [...prev, '', 'Done.']) });
    queue.dispatch(...actions);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        if (isBusy) return;
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
        return;
      }

      if (e.key === 'Escape') {
        cancel();
        return;
      }

      const hotkey = HOTKEYS[e.key];
      if (hotkey) {
        e.preventDefault();
        move(hotkey);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move, handleUndo, handleRedo, cancel, isBusy]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <AppHeader
        isMobile={isMobile}
        historyIndex={queue.historyIndex}
        totalMoves={queue.totalMoves}
        pendingCount={queue.pendingCount}
        isBusy={isBusy}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onScramble={handleScramble}
        onSolve={handleSolve}
        onResetCube={queue.resetCube}
        onResetRotation={handleResetRotation}
        onMove={move}
        theme={theme}
        onThemeChange={setTheme}
        isPanelOpen={isPanelOpen}
        onTogglePanel={() => setIsPanelOpen((v) => !v)}
      />
      <CubeLayout
        isMobile={isMobile}
        isPortrait={isPortrait}
        cube={queue.cube}
        rotationRef={rotationRef}
        animStateRef={queue.animStateRef}
        theme={theme}
        onMove={move}
        isPanelOpen={isPanelOpen}
        solverLog={solverLog}
      />
    </div>
  );
}
