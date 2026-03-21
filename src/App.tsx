import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimationService } from './animation/AnimationService';
import { EasedAnimation } from './animation/EasedAnimation';
import { MoveAnimation } from './animation/MoveAnimation';
import { RotationAnimation } from './animation/RotationAnimation';
import { easeInOutCubic } from './animation/easing';
import CubeRenderer from './components/CubeRenderer';
import { createSolvedCube } from './model/cube';
import { MOVE_PAIRS, MOVE_SPECS, applyMoveToModel, getAffectedIndices } from './model/moves';
import type { CubeModel } from './types/cube';
import type { MoveId } from './model/moves';

const MOVE_DURATION_MS = 320;
const RESET_DURATION_MS = 700;

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
  disabled: boolean;
  onMove: (id: MoveId) => void;
}

function MovePair({ cw, ccw, disabled, onMove }: MovePairProps) {
  const face = cw.replace("'", '');
  const accent = FACE_COLOR[face] ?? '#888';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      {[cw, ccw].map((id) => (
        <button
          key={id}
          disabled={disabled}
          onClick={() => onMove(id)}
          style={{
            ...moveBtnBase,
            borderColor: accent,
            color: accent,
          }}
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
  const [isAnimating, setIsAnimating] = useState(false);

  const animService = useRef(new AnimationService());
  // Always-current reference to cube — avoids stale closures in callbacks.
  const cubeRef = useRef(cube);
  cubeRef.current = cube;

  useEffect(() => {
    const service = animService.current;
    service.start();
    return () => service.stop();
  }, []);

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

  const handleMove = useCallback((move: MoveId) => {
    const { axis, angle } = MOVE_SPECS[move];
    const targetRotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const affectedIndices = getAffectedIndices(cubeRef.current.blocks, move);

    setIsAnimating(true);
    animService.current.submit(
      new EasedAnimation(
        new MoveAnimation(
          affectedIndices,
          targetRotation,
          setCube,
          (prev) => applyMoveToModel(prev, move),
          () => setIsAnimating(false),
        ),
        easeInOutCubic,
      ),
      MOVE_DURATION_MS,
    );
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={headerStyle}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em', flex: 1 }}>
          Rubik&rsquo;s Cube
        </h1>
        <button onClick={handleReset} style={resetBtnStyle}>
          Reset rotation
        </button>
      </header>

      {/* ── Main grid: buttons surrounding the canvas ───────────────────── */}
      <main style={mainGridStyle}>
        {/* Row 1 */}
        <div />
        <div style={topBottomSlot}>
          <MovePair cw="U" ccw="U'" disabled={isAnimating} onMove={handleMove} />
        </div>
        <div />

        {/* Row 2 */}
        <div style={sideSlot}>
          <MovePair cw="L" ccw="L'" disabled={isAnimating} onMove={handleMove} />
        </div>
        <CubeRenderer model={cube} onRotate={handleRotate} />
        <div style={sideSlot}>
          <MovePair cw="R" ccw="R'" disabled={isAnimating} onMove={handleMove} />
        </div>

        {/* Row 3 – D centre, F bottom-left, B bottom-right */}
        <div style={topBottomSlot}>
          <MovePair cw="F" ccw="F'" disabled={isAnimating} onMove={handleMove} />
        </div>
        <div style={topBottomSlot}>
          <MovePair cw="D" ccw="D'" disabled={isAnimating} onMove={handleMove} />
        </div>
        <div style={topBottomSlot}>
          <MovePair cw="B" ccw="B'" disabled={isAnimating} onMove={handleMove} />
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

const topBottomSlot: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const sideSlot: React.CSSProperties = {
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
