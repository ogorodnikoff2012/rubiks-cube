import React from 'react';
import * as THREE from 'three';
import CubeRenderer from './CubeRenderer';
import SolverPanel from './SolverPanel';
import type { CubeModel } from '../types/cube';
import type { FaceKey } from '../types/cube';
import type { MoveId } from '../model/moves';
import type { Theme } from '../themes/themes';
import type { AnimState } from '../animation/MoveAnimation';
import { SOLVED_COLORS } from '../model/cube';

interface Props {
  isMobile: boolean;
  isPortrait: boolean;
  cube: CubeModel;
  rotationRef: React.MutableRefObject<THREE.Quaternion>;
  animStateRef: React.MutableRefObject<AnimState>;
  theme: Theme;
  onMove: (id: MoveId) => void;
  isPanelOpen: boolean;
  solverLog: string[];
}

interface MovePairProps {
  cw: MoveId;
  ccw: MoveId;
  onMove: (id: MoveId) => void;
  theme: Theme;
}

function MovePair({ cw, ccw, onMove, theme }: MovePairProps) {
  const face = cw.replace("'", '') as FaceKey;
  const accent = theme[SOLVED_COLORS[face]] ?? '#888';
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

export default function CubeLayout({
  isMobile,
  isPortrait,
  cube,
  rotationRef,
  animStateRef,
  theme,
  onMove,
  isPanelOpen,
  solverLog,
}: Props) {
  const renderer = (
    <CubeRenderer
      model={cube}
      rotationRef={rotationRef}
      animStateRef={animStateRef}
      theme={theme}
    />
  );

  let main: React.ReactNode;

  if (isMobile && isPortrait) {
    main = (
      <main style={mobileMainStyle}>
        <div style={{ flex: 1, minHeight: 0 }}>{renderer}</div>
        <div style={mobileButtonBarStyle}>
          {(['L', 'R', 'U', 'D', 'F', 'B'] as const).map((face) => (
            <MovePair
              key={face}
              cw={face}
              ccw={`${face}'` as MoveId}
              onMove={onMove}
              theme={theme}
            />
          ))}
        </div>
      </main>
    );
  } else if (isMobile) {
    main = (
      <main style={mobileLandscapeStyle}>
        <div style={mobileSideColumnStyle}>
          <MovePair cw="U" ccw="U'" onMove={onMove} theme={theme} />
          <MovePair cw="L" ccw="L'" onMove={onMove} theme={theme} />
          <MovePair cw="F" ccw="F'" onMove={onMove} theme={theme} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{renderer}</div>
        <div style={mobileSideColumnStyle}>
          <MovePair cw="D" ccw="D'" onMove={onMove} theme={theme} />
          <MovePair cw="R" ccw="R'" onMove={onMove} theme={theme} />
          <MovePair cw="B" ccw="B'" onMove={onMove} theme={theme} />
        </div>
      </main>
    );
  } else {
    main = (
      <main style={mainGridStyle}>
        {/* Row 1 */}
        <div />
        <div style={centreSlot}>
          <MovePair cw="U" ccw="U'" onMove={onMove} theme={theme} />
        </div>
        <div />
        {/* Row 2 */}
        <div style={centreSlot}>
          <MovePair cw="L" ccw="L'" onMove={onMove} theme={theme} />
        </div>
        {renderer}
        <div style={centreSlot}>
          <MovePair cw="R" ccw="R'" onMove={onMove} theme={theme} />
        </div>
        {/* Row 3 */}
        <div style={centreSlot}>
          <MovePair cw="F" ccw="F'" onMove={onMove} theme={theme} />
        </div>
        <div style={centreSlot}>
          <MovePair cw="D" ccw="D'" onMove={onMove} theme={theme} />
        </div>
        <div style={centreSlot}>
          <MovePair cw="B" ccw="B'" onMove={onMove} theme={theme} />
        </div>
      </main>
    );
  }

  return (
    <div style={bodyStyle}>
      {main}
      {isPanelOpen && <SolverPanel lines={solverLog} />}
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  overflow: 'hidden',
};

const mobileMainStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const mobileButtonBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-around',
  alignItems: 'center',
  padding: '8px',
  paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
  gap: 8,
  flexShrink: 0,
};

const mobileLandscapeStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'row',
  overflow: 'hidden',
  paddingLeft: 'env(safe-area-inset-left)',
  paddingRight: 'env(safe-area-inset-right)',
};

const mobileSideColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-evenly',
  alignItems: 'center',
  width: 64,
  flexShrink: 0,
  padding: '8px 0',
};

const mainGridStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '96px 1fr 96px',
  gridTemplateRows: '96px 1fr 96px',
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
