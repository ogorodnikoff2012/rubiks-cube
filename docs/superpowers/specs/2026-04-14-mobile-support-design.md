# Mobile Support Design

**Date:** 2026-04-14  
**Scope:** Touch rotation + responsive header with hamburger menu

---

## Overview

Two independent improvements to make the app usable on mobile:

1. **Touch rotation** — allow rotating the cube by dragging with a finger.
2. **Responsive header** — collapse the header controls into a hamburger menu on small screens.

The viewport meta tag (`width=device-width, initial-scale=1.0`) is already present in `index.html`.

---

## 1. Touch Rotation

**File:** `src/components/CubeRenderer.tsx`

### Approach

Replace the existing `mousedown / mousemove / mouseup` event listeners with the Pointer Events API. Pointer events unify mouse and touch through a single event type, so the delta math and `DragState` interface are unchanged.

### Changes

- Remove the `mousedown` listener on canvas and the `mousemove` / `mouseup` listeners on `window`.
- Add `pointerdown`, `pointermove`, `pointerup`, and `pointercancel` listeners — all on the canvas.
- On `pointerdown`: record `lastX / lastY`, call `canvas.setPointerCapture(e.pointerId)`. Pointer capture ensures the stream stays bound to the canvas even if the pointer moves off it.
- On `pointermove`: same delta calculation and sensitivity (`0.005`) as today.
- On `pointerup` / `pointercancel`: clear `dragRef.current.active`.

The `cursor: grab` style on the canvas is kept (visible on desktop, ignored on touch).

---

## 2. Responsive Header / Hamburger Menu

**File:** `src/App.tsx`

### Breakpoint

`640px` — below this width the header collapses; above it the existing layout is unchanged.

### State

One new boolean state: `isMenuOpen` (default `false`).

### Mobile header layout (≤640px)

- Header shows: **title** (left) + **☰ button** (right).
- When `isMenuOpen` is true: an absolutely-positioned dropdown panel appears below the header, full viewport width, `z-index` above the canvas.
- The panel contains all controls grouped in rows:
  | Row | Contents |
  |-----|----------|
  | 1 | Undo · Redo |
  | 2 | Scramble · Solve · Reset · Reset rotation |
  | 3 | Cube rotation buttons (x x′ y y′ z z′) |
  | 4 | Theme select (full width) |
  | 5 | Solver toggle |
- Tapping any button in the menu closes the menu automatically (via a wrapper that calls `setIsMenuOpen(false)` after the action).
- Tapping outside the panel (on the canvas / body) closes the menu via a `pointerdown` listener on `window` that fires only when `isMenuOpen` is true and the event target is outside the panel element.

### Desktop header layout (>640px)

Unchanged. `isMenuOpen` state is irrelevant at this width.

### Move buttons (U/D/L/R/F/B)

These live in the 3×3 grid around the cube, not in the header. They remain visible at all screen sizes and are already adequate tap targets (44px wide buttons).

---

## Files changed

| File                              | Change                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| `src/components/CubeRenderer.tsx` | Replace mouse events with pointer events                              |
| `src/App.tsx`                     | Add `isMenuOpen` state + hamburger button + responsive dropdown panel |

---

## Non-goals

- Pinch-to-zoom
- Touch-based face moves (swipe on a face to execute a move)
- Accessibility / ARIA for the hamburger menu beyond what browsers provide natively
