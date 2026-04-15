# Color Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hex color strings in the cube model with semantic `ColorCode` values, and resolve them to actual hex colors in the renderer via a runtime-switchable `Theme`.

**Architecture:** A new `ColorCode` union type replaces `string` in `FaceColors`. A new `themes.ts` file defines `Theme = Record<ColorCode, string>` and ships two named themes. `CubeRenderer` receives the active theme as a prop and resolves codes → hex when building sticker materials. `App` holds `theme` in React state and renders a theme-switcher button group.

**Tech Stack:** TypeScript 5, React 18, Three.js, Vite (`yarn build` = `tsc -b && vite build`)

---

### Task 1: Add `ColorCode` type and `themes.ts`

**Files:**

- Modify: `src/types/cube.ts`
- Create: `src/themes/themes.ts`

These are purely additive changes. The existing `FaceColors` type is untouched here — that happens in Task 3.

- [ ] **Step 1: Add `ColorCode` to the types file**

In `src/types/cube.ts`, add after the `FaceKey` type:

```ts
/** Semantic color identity for a sticker — resolved to a hex value by the active Theme. */
export type ColorCode = 'WHITE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'RED' | 'ORANGE';
```

The file should now look like:

```ts
import type * as THREE from 'three';

/** The six face directions in standard Rubik's cube notation. */
export type FaceKey = 'F' | 'B' | 'U' | 'D' | 'L' | 'R';

/** Semantic color identity for a sticker — resolved to a hex value by the active Theme. */
export type ColorCode = 'WHITE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'RED' | 'ORANGE';

/** Per-face color map for a single block. Only exposed faces need an entry. */
export type FaceColors = Partial<Record<FaceKey, string>>;

/** A single cubie in the cube. Position is its grid coordinate [-1, 0, 1]^3. */
export interface Block {
  /** Grid coordinates, each in {-1, 0, 1} for a 3×3×3 cube. */
  position: [number, number, number];
  /** Colors of visible faces. Faces not present have no sticker (inner face). */
  faceColors: FaceColors;
  /** Optional per-block rotation (identity if absent). */
  rotation?: THREE.Quaternion;
}

/** Top-level cube model held in App state. */
export interface CubeModel {
  /** All 26 visible cubies (corners + edges + centers, excluding core). */
  blocks: Block[];
}
```

- [ ] **Step 2: Create `src/themes/themes.ts`**

```ts
import type { ColorCode } from '../types/cube';

/** Maps every ColorCode to a CSS hex color string. */
export type Theme = Record<ColorCode, string>;

/** Standard WCA competition colors. */
export const DEFAULT_THEME: Theme = {
  WHITE: '#ffffff',
  YELLOW: '#ffd500',
  GREEN: '#009b48',
  BLUE: '#0046ad',
  RED: '#b71234',
  ORANGE: '#ff5800',
};

/** High-contrast neon theme. */
export const NEON_THEME: Theme = {
  WHITE: '#f0f0f0',
  YELLOW: '#ffe600',
  GREEN: '#00ff88',
  BLUE: '#00aaff',
  RED: '#ff2244',
  ORANGE: '#ff8800',
};
```

- [ ] **Step 3: Verify the build passes**

```bash
yarn build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/cube.ts src/themes/themes.ts
git commit -m "feat: add ColorCode type and themes module"
```

---

### Task 2: Update `SOLVED_COLORS` to use color codes

**Files:**

- Modify: `src/model/cube.ts`

`ColorCode` is a subtype of `string`, so changing `SOLVED_COLORS` values to color codes is backward-compatible with the still-`string`-typed `FaceColors`. The build stays green.

- [ ] **Step 1: Replace `SOLVED_COLORS` in `src/model/cube.ts`**

Replace the existing `SOLVED_COLORS` declaration:

```ts
import type { Block, CubeModel, FaceColors, FaceKey } from '../types/cube';
import type { ColorCode } from '../types/cube';
```

Change:

```ts
export const SOLVED_COLORS: Record<string, string> = {
  U: '#ffffff', // top   – white
  D: '#ffd500', // bottom – yellow
  F: '#009b48', // front  – green
  B: '#0046ad', // back   – blue
  R: '#b71234', // right  – red
  L: '#ff5800', // left   – orange
};
```

To:

```ts
export const SOLVED_COLORS: Record<FaceKey, ColorCode> = {
  U: 'WHITE',
  D: 'YELLOW',
  F: 'GREEN',
  B: 'BLUE',
  R: 'RED',
  L: 'ORANGE',
};
```

Also update the import line at the top of the file:

```ts
import type { Block, CubeModel, FaceColors, FaceKey, ColorCode } from '../types/cube';
```

The `getFaceColors` function and `createSolvedCube` body are unchanged.

- [ ] **Step 2: Verify the build passes**

```bash
yarn build
```

Expected: exits 0. The solver (`layerByLayer.ts`) references `SOLVED_COLORS.U` etc. — those now yield `'WHITE'`, `'GREEN'`, etc. All comparisons in `findCenter`/`findEdge`/`findCorner` are string equality so they continue to work.

- [ ] **Step 3: Commit**

```bash
git add src/model/cube.ts
git commit -m "feat: SOLVED_COLORS now uses ColorCode values"
```

---

### Task 3: Narrow `FaceColors`, update renderer, update App

**Files:**

- Modify: `src/types/cube.ts`
- Modify: `src/model/moves.ts`
- Modify: `src/components/CubeRenderer.tsx`
- Modify: `src/App.tsx`

This task ties the whole refactor together. `FaceColors` narrows from `string` to `ColorCode`. The renderer gains a `theme` prop and resolves codes to hex. App holds theme state and shows a switcher. All four files must change in the same commit so the build stays green throughout.

- [ ] **Step 1: Narrow `FaceColors` in `src/types/cube.ts`**

Change:

```ts
export type FaceColors = Partial<Record<FaceKey, string>>;
```

To:

```ts
export type FaceColors = Partial<Record<FaceKey, ColorCode>>;
```

- [ ] **Step 2: Update `remapFaceColors` type annotation in `src/model/moves.ts`**

In `src/model/moves.ts`, find `remapFaceColors`:

```ts
function remapFaceColors(faceColors: FaceColors, rotation: THREE.Quaternion): FaceColors {
  const result: FaceColors = {};
  for (const [key, color] of Object.entries(faceColors) as [FaceKey, string][]) {
    const rotatedNormal = FACE_NORMALS[key].clone().applyQuaternion(rotation);
    result[vectorToFaceKey(rotatedNormal)] = color;
  }
  return result;
}
```

Change only the cast on line 3 — `string` → `ColorCode`:

```ts
import type { Block, CubeModel, FaceColors, FaceKey, ColorCode } from '../types/cube';
```

```ts
function remapFaceColors(faceColors: FaceColors, rotation: THREE.Quaternion): FaceColors {
  const result: FaceColors = {};
  for (const [key, color] of Object.entries(faceColors) as [FaceKey, ColorCode][]) {
    const rotatedNormal = FACE_NORMALS[key].clone().applyQuaternion(rotation);
    result[vectorToFaceKey(rotatedNormal)] = color;
  }
  return result;
}
```

Also update the import at the top of `src/model/moves.ts`:

```ts
import type { Block, CubeModel, FaceColors, FaceKey, ColorCode } from '../types/cube';
```

- [ ] **Step 3: Update `CubeRenderer` to accept and use a `theme` prop**

In `src/components/CubeRenderer.tsx`:

**a) Add the import:**

```ts
import type { Theme } from '../themes/themes';
```

**b) Change `buildCubeGroup` signature and color resolution:**

Replace:

```ts
function buildCubeGroup(model: CubeModel): THREE.Group {
  const group = new THREE.Group();

  for (const block of model.blocks) {
    const [gx, gy, gz] = block.position;
    const cubieGroup = new THREE.Group();
    cubieGroup.position.set(gx * SPACING, gy * SPACING, gz * SPACING);

    cubieGroup.add(new THREE.Mesh(CUBIE_GEOM, BLACK_MAT));

    for (const [faceKey, color] of Object.entries(block.faceColors) as [FaceKey, string][]) {
      cubieGroup.add(new THREE.Mesh(getStickerGeom(faceKey), getStickerMat(color)));
    }

    group.add(cubieGroup);
  }

  return group;
}
```

With:

```ts
function buildCubeGroup(model: CubeModel, theme: Theme): THREE.Group {
  const group = new THREE.Group();

  for (const block of model.blocks) {
    const [gx, gy, gz] = block.position;
    const cubieGroup = new THREE.Group();
    cubieGroup.position.set(gx * SPACING, gy * SPACING, gz * SPACING);

    cubieGroup.add(new THREE.Mesh(CUBIE_GEOM, BLACK_MAT));

    for (const [faceKey, colorCode] of Object.entries(block.faceColors) as [FaceKey, ColorCode][]) {
      cubieGroup.add(new THREE.Mesh(getStickerGeom(faceKey), getStickerMat(theme[colorCode])));
    }

    group.add(cubieGroup);
  }

  return group;
}
```

**c) Add `theme` to the `Props` interface:**

```ts
interface Props {
  model: CubeModel;
  rotationRef: React.MutableRefObject<THREE.Quaternion>;
  animStateRef: React.MutableRefObject<AnimState>;
  theme: Theme;
}
```

**d) Destructure `theme` in the component signature:**

```ts
export default function CubeRenderer({ model, rotationRef, animStateRef, theme }: Props) {
```

**e) Pass `theme` to `buildCubeGroup` and add it to the rebuild effect's dependency array:**

Replace:

```ts
const group = buildCubeGroup(model);
```

With:

```ts
const group = buildCubeGroup(model, theme);
```

Replace the effect's dependency array:

```ts
  }, [model, animStateRef]);
```

With:

```ts
  }, [model, animStateRef, theme]);
```

**f) Add `ColorCode` import:**

```ts
import type { CubeModel, FaceKey, ColorCode } from '../types/cube';
```

- [ ] **Step 4: Update `App.tsx` — theme state, pass to renderer, add switcher UI**

**a) Add imports at the top of `src/App.tsx`:**

```ts
import { DEFAULT_THEME, NEON_THEME } from './themes/themes';
import type { Theme } from './themes/themes';
```

**b) Inside the `App` component, after the `isPanelOpen` state line, add theme state:**

```ts
const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
```

**c) Pass `theme` to `CubeRenderer` in the JSX:**

```tsx
<CubeRenderer
  model={queue.cube}
  rotationRef={rotationRef}
  animStateRef={queue.animStateRef}
  theme={theme}
/>
```

**d) Add a theme-switcher button group to the header, just before the solver toggle button. Place it after the `<span style={dividerStyle} />` that precedes `setIsPanelOpen`:**

```tsx
<span style={dividerStyle} />;
{
  ([DEFAULT_THEME, NEON_THEME] as const).map((t, i) => (
    <button
      key={i}
      onClick={() => setTheme(t)}
      style={{ ...iconBtnStyle, fontWeight: t === theme ? 700 : 400 }}
    >
      {i === 0 ? 'WCA' : 'Neon'}
    </button>
  ));
}
```

- [ ] **Step 5: Verify the build passes**

```bash
yarn build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 6: Verify visually**

```bash
yarn dev
```

Open `http://localhost:5173`. Check:

- Cube renders with correct WCA colors (white top, yellow bottom, green front, blue back, red right, orange left)
- Click "Neon" in the header — cube immediately re-renders with neon colors
- Click "WCA" — cube returns to standard colors
- Apply a move while Neon is active — animation plays in neon colors
- Theme switch also works mid-scramble

- [ ] **Step 7: Commit**

```bash
git add src/types/cube.ts src/model/moves.ts src/components/CubeRenderer.tsx src/App.tsx
git commit -m "feat: runtime color themes — model uses ColorCode, renderer resolves via Theme"
```
