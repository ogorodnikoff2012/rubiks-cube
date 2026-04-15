# Rubik's Cube — project guide

## Quick start

```bash
yarn install
yarn dev        # Vite dev server at http://localhost:5173/rubiks-cube/
yarn build      # tsc + Vite production build → dist/
yarn lint       # ESLint
yarn format     # Prettier (write)
yarn format:check
```

## Stack

| Layer           | Choice                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------ |
| Language        | TypeScript 5 (strict, `noUnusedLocals`, `noUncheckedSideEffectImports`)                    |
| UI framework    | React 18 (StrictMode)                                                                      |
| 3-D rendering   | Three.js via WebGL, mounted on a plain `<canvas>`                                          |
| Build           | Vite 6 (split tsconfig: `tsconfig.app.json` for src, `tsconfig.node.json` for vite config) |
| Package manager | Yarn classic (v1)                                                                          |
| Linter          | ESLint 9 flat config — `typescript-eslint` strict + `react-hooks` + `react-refresh`        |
| Formatter       | Prettier — single quotes, trailing commas, 100-char width                                  |

---

## Deployment

**Live URL:** `https://ogorodnikoff2012.github.io/rubiks-cube/`

Deployed automatically via GitHub Actions on every push to `master`. The workflow (`.github/workflows/ci.yml`) has two jobs:

- **`ci`** — runs `yarn lint`, `yarn format:check`, `yarn build` on every push and PR
- **`deploy`** — builds and publishes to GitHub Pages via OIDC; runs only on `master` push, requires `ci` to pass

`vite.config.ts` sets `base: '/rubiks-cube/'` so all built asset paths are prefixed for the Pages subdirectory. The dev server also serves at `/rubiks-cube/` rather than `/`.

**Branch protection on `master`:** PRs required before merging; the `CI / ci` status check must pass; force push disabled.

---

## Repository layout

```
src/
  types/
    cube.ts            # Core data types (Block, CubeModel, FaceKey, FaceColors)
  model/
    cube.ts            # createSolvedCube() factory
    moves.ts           # Move definitions, rotation math, model mutation
  animation/
    IAnimation.ts      # Interface + contract
    AnimationService.ts
    EasedAnimation.ts
    RotationAnimation.ts
    MoveAnimation.ts
    easing.ts          # EasingFn presets
  components/
    CubeRenderer.tsx   # Three.js WebGL renderer as a React component
  App.tsx              # Root component — state, queue, history, UI layout
  main.tsx             # React entry point
  index.css            # Global reset + dark background
```

---

## Data model (`src/types/cube.ts`)

### Coordinate system

```
  y (+up)
  │
  │   z (+front / toward viewer)
  │  ╱
  │ ╱
  └────── x (+right)
```

Grid positions: each axis is in `{-1, 0, 1}`. There are 26 visible cubies; the centre core (`0,0,0`) is omitted.

### `Block`

```ts
interface Block {
  position: [number, number, number]; // grid coords, each ∈ {-1, 0, 1}
  faceColors: Partial<Record<FaceKey, string>>; // only exposed faces
  rotation?: THREE.Quaternion; // set only during a move animation
}
```

`rotation` is `undefined` at rest. During a face-move animation the affected cubies carry a non-null quaternion; the renderer applies it as an **orbital** transform (rotates both position and orientation around the cube centre).

### `CubeModel`

```ts
interface CubeModel {
  blocks: Block[];
}
```

`CubeModel` is immutable React state — every change produces a new object.

### Solved-state colors (WCA orientation)

| Face   | Key | Color            |
| ------ | --- | ---------------- |
| Top    | `U` | white `#ffffff`  |
| Bottom | `D` | yellow `#ffd500` |
| Front  | `F` | green `#009b48`  |
| Back   | `B` | blue `#0046ad`   |
| Right  | `R` | red `#b71234`    |
| Left   | `L` | orange `#ff5800` |

---

## Model layer (`src/model/`)

### `cube.ts`

`createSolvedCube()` — iterates `x,y,z ∈ {-1,0,1}`, assigns face colors to the block faces that lie on the cube's outer surface, and returns a `CubeModel`.

### `moves.ts`

**`MoveId`** — union of 18 move identifiers: the 12 face quarter-turns (`R R' L L' U U' D D' F F' B B'`) plus the 6 whole-cube rotations (`x x' y y' z z'`).

**`FACE_MOVES`** — the 12 face-turn `MoveId`s, used for scramble generation (excludes whole-cube rotations).

**`MOVE_SPECS`** — per-move `{ axis, angle, axisIndex, sliceValue }`:

| Move        | Axis      | Angle         | Slice      |
| ----------- | --------- | ------------- | ---------- |
| R           | +x        | +90°          | x = +1     |
| L           | +x        | −90°          | x = −1     |
| U           | +y        | +90°          | y = +1     |
| D           | +y        | −90°          | y = −1     |
| F           | +z        | −90°          | z = +1     |
| B           | +z        | +90°          | z = −1     |
| prime moves | same axis | negated angle | same slice |

Angles follow the right-hand rule (positive = CCW from +axis). This matches standard Rubik's notation where each letter is CW when looking at that face.

**`getAffectedIndices(blocks, move)`** — returns array indices of blocks in the move's slice.

**`applyMoveToModel(cube, move)`** — pure function that returns a new `CubeModel`:

1. Applies the rotation quaternion to each affected block's `position` (integer grid coords, rounded after rotation).
2. Remaps `faceColors` by rotating each face's unit normal through the same quaternion and mapping back to a `FaceKey` — no hardcoded permutation tables.
3. Clears `block.rotation` on all affected blocks.

**`INVERSE_MOVE`** — `Record<MoveId, MoveId>` mapping each move to its inverse (`R ↔ R'` etc.).

**`ALL_MOVES`** — flat array of all 12 `MoveId`s, used by the scrambler.

---

## Animation system (`src/animation/`)

### `IAnimation` contract

```
If submitted:  onBegin() called once
               onUpdate(p) called zero or more times, p strictly increasing ∈ [0,1]
               onEnd()  called once
```

`onBegin()` is called synchronously inside `AnimationService.submit()`, so if the service is stopped before the first tick, `onEnd()` is still guaranteed.

### `AnimationService`

Drives a `Set<AnimationContext>` via `requestAnimationFrame`. The RAF loop runs continuously while `start()` has been called; `stop()` cancels it and calls `onEnd()` on every live context.

- `start()` — throws if already running (guards against double-start)
- `stop()` — idempotent; calls `onEnd()` on all live animations then clears
- `submit(animation, durationMs)` — calls `onBegin()` immediately, registers context; throws if not running

Multiple animations can run concurrently (the service doesn't serialize them).

### `EasedAnimation`

Proxy wrapper: forwards `onBegin`/`onEnd` unchanged, remaps `p` through an `EasingFn` before calling `onUpdate`. Available easing presets: `linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInOutCubic`, `easeInOutQuart`.

### `RotationAnimation`

Animates a single `THREE.Quaternion` from `from` to `to` via slerp, calling `setFn(q)` each frame. Used for the whole-cube "reset rotation" animation.

### `MoveAnimation`

Animates a face-rotation move:

- Constructor receives `committedModel` (the fully-resolved post-move cube state) **pre-computed by the caller** — not computed inside the animation.
- `onUpdate(p)` — sets `block.rotation` on affected blocks to `slerp(identity, targetRotation, p)`. The renderer interprets this as an orbital rotation (see below).
- `onEnd()` — installs `committedModel` via `setCube(() => committedModel)` (no dependency on React's `prev`) and calls `onComplete(committedModel)`.

The pre-computation of `committedModel` is critical: `applyMoveToModel` is called **before** submission so the next queued move can read correct block positions synchronously, without waiting for React to flush the `setCube` call.

---

## Renderer (`src/components/CubeRenderer.tsx`)

A React component that owns a `<canvas>` and manages a Three.js scene inside `useEffect` hooks.

### Scene structure

```
Scene
└── cubeGroup  (quaternion = rotationRef.current)
    └── cubieGroup × 26  (one per Block)
        ├── Mesh (BoxGeometry)           black body
        └── Mesh (PlaneGeometry) × 1–3  coloured sticker per visible face
```

### Orbital rotation during moves

When `block.rotation` is set, the cubie group gets:

```ts
worldPos = originalGridPos.applyQuaternion(block.rotation);
cubieGroup.position = worldPos; // orbits the cube centre
cubieGroup.quaternion = block.rotation; // face orientations follow
```

This makes cubies sweep around the cube centre rather than spinning in place. Without this, animated cubies would detach from the face visually.

At the move's end `block.rotation` is cleared and the logical block positions/face-colors are updated — the visual state is continuous at the boundary.

### React integration

Three separate `useEffect` hooks:

1. **Init** (runs once): creates `WebGLRenderer`, `Scene`, `PerspectiveCamera`, `ResizeObserver`.
2. **Rebuild** (runs on every `model` change): removes the old `cubeGroup`, builds a new one from scratch via `buildCubeGroup(model)`.
3. **Render loop** (runs once): `requestAnimationFrame` loop calling `renderer.render(scene, camera)`.

The rebuild-on-every-model-change approach is simple and correct; geometry is cheap at this scale.

### Mouse drag

`mousedown` / `mousemove` / `mouseup` handlers on `canvas`/`window`. Each `mousemove` delta is converted to a world-space quaternion delta and composed directly into `rotationRef` (a prop passed in from App):

```ts
delta = qY(dx) * qX(dy);
rotationRef.current = delta * rotationRef.current;
```

---

## App (`src/App.tsx`)

The root component. Holds all mutable state and orchestrates animations.

### State

Visible React state is encapsulated in the `useCubeQueue` hook and exposed via the `queue` object:

| Field          | Type        | Purpose                                                                         |
| -------------- | ----------- | ------------------------------------------------------------------------------- |
| `cube`         | `CubeModel` | Current rendered cube (React-managed, updated at end of each animation)         |
| `historyIndex` | `number`    | How many history entries are applied; `moves[historyIndex..]` is the redo stack |
| `totalMoves`   | `number`    | Total moves in the history array                                                |
| `pendingCount` | `number`    | Items in the queue that haven't started animating yet                           |
| `isAnimating`  | `boolean`   | A move animation is currently in flight                                         |
| `isBusy`       | `boolean`   | `isAnimating \|\| pendingCount > 0`; used to gate undo/redo in the UI           |

App also owns:

| Ref           | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `rotationRef` | Whole-cube visual quaternion — read by RAF loop every frame, written by drag and RotationAnimation |

### Refs inside `useCubeQueue` (synchronous state, bypass React batching)

| Ref                | Purpose                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `committedCubeRef` | Fully-resolved cube model; updated synchronously in `onDone` — one render ahead of `setCube`     |
| `histRef`          | Mirrors `historyIndex` / move list for use in animation callbacks without waiting for re-renders |
| `queueRef`         | Mutable action queue; plain array mutation avoids stale-closure issues with `useState`           |
| `isProcessingRef`  | Guards against starting a second concurrent drain loop                                           |
| `generationRef`    | Bumped by `resetCube()` so in-flight animation callbacks can detect a reset and become no-ops    |
| `animStateRef`     | Current move animation state (indices + quaternion) read each frame by CubeRenderer's RAF loop   |

### Move execution pipeline

```
dispatch(action)
  │
  └─ push to queueRef, setPendingCount()
     │
     [background useEffect: starts drain when pendingCount > 0 and no drain running]
     │
     drain()
       │
       ├─ case 'effect': fn() then drain() immediately
       │
       ├─ case 'move':
       │     trim redo stack if needed
       │     setIsAnimating(true)
       │     runMoveAnimation(move, committedCubeRef.current, onDone)
       │       ├─ compute affectedIndices from currentModel.blocks
       │       ├─ compute committedModel = applyMoveToModel(...)  ← eager!
       │       └─ submit EasedAnimation(MoveAnimation(...))
       │
       ├─ case 'undo': animate INVERSE_MOVE[history[index-1]], then onDone
       ├─ case 'redo': animate history[index], then onDone
       │
       └─ onDone(committed):
            committedCubeRef.current = committed
            update histRef, setHistoryIndex()
            drain()  ← recurse for next queued action
```

### History

- **Forward move**: truncate `moves[historyIndex..]`, append new move, increment `historyIndex`.
- **Undo**: run `INVERSE_MOVE[moves[historyIndex-1]]`, decrement `historyIndex`. Does not alter the `moves` array.
- **Redo**: run `moves[historyIndex]`, increment `historyIndex`.
- Undo/redo are blocked while `isBusy`; forward moves are always accepted (queued).

### Keyboard shortcuts

| Key                               | Action                                        |
| --------------------------------- | --------------------------------------------- |
| `f`                               | F (CW)                                        |
| `F` (Shift+f)                     | F′ (CCW)                                      |
| `b/B`, `r/R`, `l/L`, `u/U`, `d/D` | same pattern for B, R, L, U, D                |
| `Ctrl+Z`                          | Undo                                          |
| `Ctrl+Shift+Z` / `Ctrl+Y`         | Redo                                          |
| `Escape`                          | Clear move queue (current animation finishes) |

---

## Key design decisions and pitfalls

### `committedCubeRef` vs React `cube` state

React's `cube` state lags one render behind `setCube()` calls. When `drain` starts the next animation synchronously inside `onDone`, React hasn't flushed the previous move's `setCube()` yet. If `getAffectedIndices` read from stale state, it would see old block positions and animate the wrong cubies.

`committedCubeRef` is updated synchronously in `onDone`, always one step ahead of React. All calls to `getAffectedIndices` and `applyMoveToModel` use `committedCubeRef.current`.

`committedCubeRef` is only synced from React state when `isProcessingRef` is false (idle), preventing mid-animation React renders from overwriting it.

### `MoveAnimation` receives a pre-computed model

`MoveAnimation.onEnd()` calls `setCube(() => this.committedModel)` — a constant, not an updater function. This means the installed state doesn't depend on whatever React's internal `prev` happens to be at flush time, making the commit deterministic even under batching or concurrent mode.

### `AnimationService` runs all submitted animations concurrently

`MoveAnimation` and `RotationAnimation` (reset rotation) can overlap. The queue serialises move animations; the "reset rotation" animation is submitted independently and runs alongside whatever is current. This is intentional — rotation reset is a visual-only operation and doesn't affect block positions.

### `IAnimation` contract and `stop()`

When `stop()` is called (component unmount), every live animation gets `onEnd()`. `MoveAnimation.onEnd()` will install `committedModel` into React state (harmless during unmount) and call `onComplete`, which may call `setIsAnimating` etc. — also harmless since the component is unmounting.
