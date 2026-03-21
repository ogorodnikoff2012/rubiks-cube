import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimationService } from './animation/AnimationService';
import { EasedAnimation } from './animation/EasedAnimation';
import { RotationAnimation } from './animation/RotationAnimation';
import { easeInOutCubic } from './animation/easing';
import CubeRenderer from './components/CubeRenderer';
import { createSolvedCube } from './model/cube';
import type { CubeModel } from './types/cube';

const RESET_DURATION_MS = 700;

export default function App() {
  const [cube, setCube] = useState<CubeModel>(createSolvedCube);

  // Stable ref — never recreated, survives re-renders.
  const animService = useRef(new AnimationService());

  useEffect(() => {
    const service = animService.current;
    service.start();
    return () => service.stop();
  }, []);

  const handleRotate = useCallback((q: THREE.Quaternion) => {
    setCube((prev) => ({ ...prev, rotation: q }));
  }, []);

  // Capture current rotation at click time so the animation starts from the
  // exact orientation visible to the user when they pressed the button.
  const handleReset = useCallback(() => {
    setCube((prev) => {
      animService.current.submit(
        new EasedAnimation(
          new RotationAnimation(prev.rotation, new THREE.Quaternion(), (q) => {
            setCube((p) => ({ ...p, rotation: q }));
          }),
          easeInOutCubic,
        ),
        RESET_DURATION_MS,
      );
      return prev; // no immediate state change; animation drives the update
    });
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '10px 24px',
          background: '#16213e',
          borderBottom: '1px solid #0f3460',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          userSelect: 'none',
        }}
      >
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em', flex: 1 }}>
          Rubik&rsquo;s Cube
        </h1>
        <button onClick={handleReset} style={resetBtnStyle}>
          Reset rotation
        </button>
      </header>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <CubeRenderer model={cube} onRotate={handleRotate} />
      </main>
    </div>
  );
}

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
