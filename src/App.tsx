import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import CubeRenderer from './components/CubeRenderer';
import SolverPanel from './components/SolverPanel';
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
import { DEFAULT_THEME, THEMES } from './themes/themes';
import type { Theme } from './themes/themes';
import { SOLVED_COLORS } from './model/cube';
import type { FaceKey } from './types/cube';

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

// --------------------------------------------------------------------------
// Small presentational components
// --------------------------------------------------------------------------

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

// --------------------------------------------------------------------------
// App
// --------------------------------------------------------------------------

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const handleResetRotation = useCallback(() => {
    animService.submit(
      new EasedAnimation(
        new RotationAnimation(rotationRef.current.clone(), INITIAL_ROTATION.clone(), (q) => {
          rotationRef.current = q; // RAF loop picks this up on the next frame
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
      // Capture label in closure for the effect.
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
        if (isBusy) return; // undo / redo blocked while busy
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

      // Move keys are always accepted (enqueued if busy).
      const hotkey = HOTKEYS[e.key];
      if (hotkey) {
        e.preventDefault();
        move(hotkey);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move, handleUndo, handleRedo, cancel, isBusy]);

  // Close hamburger menu when viewport grows past the mobile breakpoint.
  useEffect(() => {
    if (!isMobile) setIsMenuOpen(false);
  }, [isMobile]);

  // Dismiss hamburger menu when tapping outside the panel.
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
      <header style={{ ...headerStyle, position: 'relative' }}>
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
            <span
              style={{
                fontSize: '0.8rem',
                color: '#8899aa',
                fontFamily: 'monospace',
                marginLeft: 'auto',
              }}
            >
              {queue.historyIndex}/{queue.totalMoves}
              {queue.pendingCount > 0 && ` +${queue.pendingCount}`}
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
                  <button onClick={handleUndo} disabled={!canUndo} style={iconBtnStyle}>
                    ↩ Undo
                  </button>
                  <button onClick={handleRedo} disabled={!canRedo} style={iconBtnStyle}>
                    Redo ↪
                  </button>
                </div>
                <div style={menuRowStyle}>
                  <button onClick={handleScramble} style={resetBtnStyle}>
                    Scramble
                  </button>
                  <button onClick={handleSolve} disabled={queue.isBusy} style={resetBtnStyle}>
                    Solve
                  </button>
                  <button onClick={queue.resetCube} style={resetBtnStyle}>
                    Reset
                  </button>
                  <button onClick={handleResetRotation} style={resetBtnStyle}>
                    Reset rotation
                  </button>
                </div>
                <div style={menuRowStyle}>
                  {(['x', "x'", 'y', "y'", 'z', "z'"] as const).map((id) => (
                    <button key={id} onClick={() => move(id)} style={cubeTurnBtnStyle}>
                      {id}
                    </button>
                  ))}
                </div>
                <div style={menuRowStyle} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={THEMES.find((t) => t.theme === theme)?.name ?? THEMES[0].name}
                    onChange={(e) =>
                      setTheme(
                        THEMES.find((t) => t.name === e.target.value)?.theme || DEFAULT_THEME,
                      )
                    }
                    style={{ ...themeSelectStyle, flex: 1 }}
                  >
                    {THEMES.map(({ name }) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={menuRowStyle}>
                  <button onClick={() => setIsPanelOpen((v) => !v)} style={iconBtnStyle}>
                    {isPanelOpen ? 'Solver ◀' : 'Solver ▶'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <span style={{ fontSize: '0.8rem', color: '#8899aa', fontFamily: 'monospace' }}>
              {queue.historyIndex}/{queue.totalMoves}
              {queue.pendingCount > 0 && ` +${queue.pendingCount}`}
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
            <button onClick={handleSolve} disabled={queue.isBusy} style={resetBtnStyle}>
              Solve
            </button>
            <button onClick={queue.resetCube} style={resetBtnStyle}>
              Reset
            </button>
            <button onClick={handleResetRotation} style={resetBtnStyle}>
              Reset rotation
            </button>
            <span style={dividerStyle} />
            {(['x', "x'", 'y', "y'", 'z', "z'"] as const).map((id) => (
              <button key={id} onClick={() => move(id)} style={cubeTurnBtnStyle}>
                {id}
              </button>
            ))}
            <span style={dividerStyle} />
            <select
              value={THEMES.find((t) => t.theme === theme)?.name ?? THEMES[0].name}
              onChange={(e) =>
                setTheme(THEMES.find((t) => t.name === e.target.value)?.theme || DEFAULT_THEME)
              }
              style={themeSelectStyle}
            >
              {THEMES.map(({ name }) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button onClick={() => setIsPanelOpen((v) => !v)} style={iconBtnStyle}>
              {isPanelOpen ? 'Solver ◀' : 'Solver ▶'}
            </button>
          </>
        )}
      </header>

      <div style={bodyStyle}>
        {isMobile && isPortrait ? (
          /* ── Portrait mobile: cube on top, button bar at bottom ── */
          <main style={mobileMainStyle}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <CubeRenderer
                model={queue.cube}
                rotationRef={rotationRef}
                animStateRef={queue.animStateRef}
                theme={theme}
              />
            </div>
            <div style={mobileButtonBarStyle}>
              {(['L', 'R', 'U', 'D', 'F', 'B'] as const).map((face) => (
                <MovePair
                  key={face}
                  cw={face}
                  ccw={`${face}'` as MoveId}
                  onMove={move}
                  theme={theme}
                />
              ))}
            </div>
          </main>
        ) : isMobile ? (
          /* ── Landscape mobile: side columns flanking the cube ── */
          <main style={mobileLandscapeStyle}>
            <div style={mobileSideColumnStyle}>
              <MovePair cw="U" ccw="U'" onMove={move} theme={theme} />
              <MovePair cw="L" ccw="L'" onMove={move} theme={theme} />
              <MovePair cw="F" ccw="F'" onMove={move} theme={theme} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CubeRenderer
                model={queue.cube}
                rotationRef={rotationRef}
                animStateRef={queue.animStateRef}
                theme={theme}
              />
            </div>
            <div style={mobileSideColumnStyle}>
              <MovePair cw="D" ccw="D'" onMove={move} theme={theme} />
              <MovePair cw="R" ccw="R'" onMove={move} theme={theme} />
              <MovePair cw="B" ccw="B'" onMove={move} theme={theme} />
            </div>
          </main>
        ) : (
          <main style={mainGridStyle}>
            {/* Row 1 */}
            <div />
            <div style={centreSlot}>
              <MovePair cw="U" ccw="U'" onMove={move} theme={theme} />
            </div>
            <div />

            {/* Row 2 */}
            <div style={centreSlot}>
              <MovePair cw="L" ccw="L'" onMove={move} theme={theme} />
            </div>
            <CubeRenderer
              model={queue.cube}
              rotationRef={rotationRef}
              animStateRef={queue.animStateRef}
              theme={theme}
            />
            <div style={centreSlot}>
              <MovePair cw="R" ccw="R'" onMove={move} theme={theme} />
            </div>

            {/* Row 3 – F bottom-left, D centre, B bottom-right */}
            <div style={centreSlot}>
              <MovePair cw="F" ccw="F'" onMove={move} theme={theme} />
            </div>
            <div style={centreSlot}>
              <MovePair cw="D" ccw="D'" onMove={move} theme={theme} />
            </div>
            <div style={centreSlot}>
              <MovePair cw="B" ccw="B'" onMove={move} theme={theme} />
            </div>
          </main>
        )}

        {isPanelOpen && <SolverPanel lines={solverLog} />}
      </div>
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
