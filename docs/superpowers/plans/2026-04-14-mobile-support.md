# Mobile Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add touch-based cube rotation and a responsive hamburger menu so the app is usable on mobile devices.

**Architecture:** Replace the mouse-only drag listeners in `CubeRenderer` with the unified Pointer Events API (handles both mouse and touch). In `App`, introduce a `useIsMobile` hook that reacts to viewport width and conditionally renders either the existing desktop header or a hamburger button + dropdown panel.

**Tech Stack:** React 18, TypeScript 5, Three.js, Vite — no new dependencies.

---

## File Map

| File                              | Change                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/CubeRenderer.tsx` | Replace `mousedown/mousemove/mouseup` useEffect with pointer events; add `touchAction: 'none'` to canvas                               |
| `src/hooks/useIsMobile.ts`        | New hook — returns `true` when viewport width ≤ 640px                                                                                  |
| `src/App.tsx`                     | Add `isMenuOpen` state + `menuRef` + `hamburgerRef`; add outside-tap effect; conditionally render hamburger vs desktop header controls |

---

## Task 1: Replace mouse drag with pointer events in CubeRenderer

**Files:**

- Modify: `src/components/CubeRenderer.tsx`

- [ ] **Step 1: Replace the drag useEffect**

  In `src/components/CubeRenderer.tsx`, find the `// ── Mouse drag handling` useEffect (lines 240–281) and replace it entirely:

  ```tsx
  // ── Pointer drag handling (mouse + touch) ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active) return;

      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;

      const sensitivity = 0.005;
      const angleX = dy * sensitivity;
      const angleY = dx * sensitivity;

      _dragQX.setFromAxisAngle(_axisX, angleX);
      _dragQY.setFromAxisAngle(_axisY, angleY).multiply(_dragQX);
      _dragResult.copy(rotationRef.current).premultiply(_dragQY);
      rotationRef.current = _dragResult;
    };

    const onPointerUp = () => {
      dragRef.current.active = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [rotationRef]);
  ```

- [ ] **Step 2: Add `touchAction: 'none'` to the canvas**

  In the `return` block of `CubeRenderer`, update the canvas style so the browser doesn't intercept touch gestures:

  ```tsx
  <canvas ref={canvasRef} style={{ display: 'block', cursor: 'grab', touchAction: 'none' }} />
  ```

- [ ] **Step 3: Lint and build**

  ```bash
  yarn lint && yarn build
  ```

  Expected: no errors, build succeeds.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/CubeRenderer.tsx
  git commit -m "feat: replace mouse drag with pointer events for touch support"
  ```

---

## Task 2: Add `useIsMobile` hook

**Files:**

- Create: `src/hooks/useIsMobile.ts`

- [ ] **Step 1: Create the hook**

  Create `src/hooks/useIsMobile.ts`:

  ```ts
  import { useEffect, useState } from 'react';

  /**
   * Returns true when the viewport width is at or below the given breakpoint (default 640px).
   * Reacts to window resize and orientation change via matchMedia.
   */
  export function useIsMobile(breakpoint = 640): boolean {
    const [isMobile, setIsMobile] = useState(() =>
      typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
    );

    useEffect(() => {
      const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
      const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
      mq.addEventListener('change', handler);
      setIsMobile(mq.matches);
      return () => mq.removeEventListener('change', handler);
    }, [breakpoint]);

    return isMobile;
  }
  ```

- [ ] **Step 2: Lint**

  ```bash
  yarn lint
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/hooks/useIsMobile.ts
  git commit -m "feat: add useIsMobile hook"
  ```

---

## Task 3: Responsive hamburger menu in App

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Import `useIsMobile` and `useRef`**

  At the top of `src/App.tsx`, `useRef` is already imported. Add the new hook import after the existing hooks import:

  ```tsx
  import { useIsMobile } from './hooks/useIsMobile';
  ```

- [ ] **Step 2: Add state and refs inside the `App` component**

  After the `rotationRef` declaration (around line 101), add:

  ```tsx
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  ```

- [ ] **Step 3: Close menu when resizing to desktop**

  After the keyboard shortcut `useEffect`, add:

  ```tsx
  // Close hamburger menu when viewport grows past the mobile breakpoint.
  useEffect(() => {
    if (!isMobile) setIsMenuOpen(false);
  }, [isMobile]);
  ```

- [ ] **Step 4: Add outside-tap handler**

  After the effect from Step 3, add:

  ```tsx
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
  ```

- [ ] **Step 5: Replace the header JSX**

  Replace the entire `<header>...</header>` block with the following. The desktop branch is identical to the current header. The mobile branch shows only the title, move counter, and hamburger button, with a dropdown panel when open.

  ```tsx
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
            <div style={menuRowStyle}>
              <select
                value={THEMES.find((t) => t.theme === theme)?.name ?? THEMES[0].name}
                onChange={(e) =>
                  setTheme(THEMES.find((t) => t.name === e.target.value)?.theme || DEFAULT_THEME)
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
  ```

- [ ] **Step 6: Add new styles at the bottom of `src/App.tsx`**

  After the `dividerStyle` constant, append:

  ```tsx
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
  ```

- [ ] **Step 7: Lint and build**

  ```bash
  yarn lint && yarn build
  ```

  Expected: no errors, build succeeds.

- [ ] **Step 8: Manual verification**

  Run `yarn dev`, open the app, and verify:
  - **Desktop (> 640px):** Header looks identical to before. Mouse drag still rotates the cube.
  - **Mobile (resize browser to < 640px or use DevTools device emulation):**
    - Header shows title, move counter, and ☰ button only.
    - Tapping ☰ opens the dropdown panel with all controls.
    - Each button works and closes the panel.
    - Tapping outside the panel closes it.
    - Touch drag on the canvas rotates the cube.
    - Move buttons (U/D/L/R/F/B) around the cube are still visible and tappable.

- [ ] **Step 9: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat: responsive hamburger menu for mobile"
  ```
