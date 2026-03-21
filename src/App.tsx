import { useCallback, useState } from 'react';
import * as THREE from 'three';
import CubeRenderer from './components/CubeRenderer';
import { createSolvedCube } from './model/cube';
import type { CubeModel } from './types/cube';

export default function App() {
  const [cube, setCube] = useState<CubeModel>(createSolvedCube);

  const handleRotate = useCallback((q: THREE.Quaternion) => {
    setCube((prev) => ({ ...prev, rotation: q }));
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '12px 24px',
          background: '#16213e',
          borderBottom: '1px solid #0f3460',
          userSelect: 'none',
        }}
      >
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em' }}>
          Rubik&rsquo;s Cube
        </h1>
      </header>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <CubeRenderer model={cube} onRotate={handleRotate} />
      </main>
    </div>
  );
}
