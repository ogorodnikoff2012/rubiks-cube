import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_THEME, THEMES } from '../themes/themes';
import type { Theme } from '../themes/themes';
import type { MoveId } from '../model/moves';

interface Props {
  isMobile: boolean;
  historyIndex: number;
  totalMoves: number;
  pendingCount: number;
  isBusy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onScramble: () => void;
  onSolve: () => void;
  onResetCube: () => void;
  onResetRotation: () => void;
  onMove: (id: MoveId) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
}

const CUBE_TURNS = ['x', "x'", 'y', "y'", 'z', "z'"] as const;

export default function AppHeader({
  isMobile,
  historyIndex,
  totalMoves,
  pendingCount,
  isBusy,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onScramble,
  onSolve,
  onResetCube,
  onResetRotation,
  onMove,
  theme,
  onThemeChange,
  isPanelOpen,
  onTogglePanel,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobile) setIsMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const outsideMenu = !menuRef.current?.contains(e.target as Node);
      const outsideHamburger = !hamburgerRef.current?.contains(e.target as Node);
      if (outsideMenu && outsideHamburger) setIsMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  const currentThemeName = THEMES.find((t) => t.theme === theme)?.name ?? THEMES[0].name;
  const handleThemeSelect = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onThemeChange(THEMES.find((t) => t.name === e.target.value)?.theme ?? DEFAULT_THEME);

  const histCounter = (
    <span style={historyCounterStyle}>
      {historyIndex}/{totalMoves}
      {pendingCount > 0 && ` +${pendingCount}`}
    </span>
  );

  const themeSelect = (extraStyle?: React.CSSProperties) => (
    <select
      value={currentThemeName}
      onChange={handleThemeSelect}
      style={{ ...themeSelectStyle, ...extraStyle }}
    >
      {THEMES.map(({ name }) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );

  return (
    <header style={headerStyle}>
      <h1
        style={{
          fontSize: '1.1rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          flex: isMobile ? 0 : 1,
        }}
      >
        Rubik&rsquo;s Cube
      </h1>

      {isMobile ? (
        <>
          <span style={{ ...historyCounterStyle, marginLeft: 'auto' }}>
            {historyIndex}/{totalMoves}
            {pendingCount > 0 && ` +${pendingCount}`}
          </span>
          <button
            ref={hamburgerRef}
            onClick={() => setIsMenuOpen((v) => !v)}
            style={hamburgerBtnStyle}
            aria-label="Menu"
          >
            {isMenuOpen ? '✕' : '☰'}
          </button>
          {isMenuOpen && (
            <div ref={menuRef} style={menuPanelStyle} onClick={() => setIsMenuOpen(false)}>
              <div style={menuRowStyle}>
                <button onClick={onUndo} disabled={!canUndo} style={iconBtnStyle}>
                  ↩ Undo
                </button>
                <button onClick={onRedo} disabled={!canRedo} style={iconBtnStyle}>
                  Redo ↪
                </button>
              </div>
              <div style={menuRowStyle}>
                <button onClick={onScramble} style={resetBtnStyle}>
                  Scramble
                </button>
                <button onClick={onSolve} disabled={isBusy} style={resetBtnStyle}>
                  Solve
                </button>
                <button onClick={onResetCube} style={resetBtnStyle}>
                  Reset
                </button>
                <button onClick={onResetRotation} style={resetBtnStyle}>
                  Reset rotation
                </button>
              </div>
              <div style={menuRowStyle}>
                {CUBE_TURNS.map((id) => (
                  <button key={id} onClick={() => onMove(id)} style={cubeTurnBtnStyle}>
                    {id}
                  </button>
                ))}
              </div>
              <div style={menuRowStyle} onClick={(e) => e.stopPropagation()}>
                {themeSelect({ flex: 1 })}
              </div>
              <div style={menuRowStyle}>
                <button onClick={onTogglePanel} style={iconBtnStyle}>
                  {isPanelOpen ? 'Solver ◀' : 'Solver ▶'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {histCounter}
          <button onClick={onUndo} disabled={!canUndo} style={iconBtnStyle}>
            ↩ Undo
          </button>
          <button onClick={onRedo} disabled={!canRedo} style={iconBtnStyle}>
            Redo ↪
          </button>
          <button onClick={onScramble} style={resetBtnStyle}>
            Scramble
          </button>
          <button onClick={onSolve} disabled={isBusy} style={resetBtnStyle}>
            Solve
          </button>
          <button onClick={onResetCube} style={resetBtnStyle}>
            Reset
          </button>
          <button onClick={onResetRotation} style={resetBtnStyle}>
            Reset rotation
          </button>
          <span style={dividerStyle} />
          {CUBE_TURNS.map((id) => (
            <button key={id} onClick={() => onMove(id)} style={cubeTurnBtnStyle}>
              {id}
            </button>
          ))}
          <span style={dividerStyle} />
          {themeSelect()}
          <button onClick={onTogglePanel} style={iconBtnStyle}>
            {isPanelOpen ? 'Solver ◀' : 'Solver ▶'}
          </button>
        </>
      )}
    </header>
  );
}

const headerStyle: React.CSSProperties = {
  padding: '10px 24px',
  background: '#16213e',
  borderBottom: '1px solid #0f3460',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  userSelect: 'none',
  position: 'relative',
};

const historyCounterStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#8899aa',
  fontFamily: 'monospace',
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

const cubeTurnBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '0.8rem',
  fontWeight: 700,
  fontFamily: 'monospace',
  background: 'transparent',
  color: '#8899bb',
  border: '1px solid #2a3a5a',
  borderRadius: 4,
  cursor: 'pointer',
};

const themeSelectStyle: React.CSSProperties = {
  padding: '6px 28px 6px 12px',
  fontSize: '0.85rem',
  fontWeight: 500,
  background: `#1a2a4a url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23aac' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 8px center`,
  color: '#aac',
  border: '1px solid #2a3a5a',
  borderRadius: 4,
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background: '#1e2e4a',
  margin: '0 4px',
};

const hamburgerBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '1.1rem',
  background: 'transparent',
  color: '#aac',
  border: '1px solid #2a3a5a',
  borderRadius: 4,
  cursor: 'pointer',
};

const menuPanelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: '#16213e',
  borderBottom: '1px solid #0f3460',
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  zIndex: 100,
};

const menuRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
};
