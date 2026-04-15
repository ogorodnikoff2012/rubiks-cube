# Color Themes Design

**Date:** 2026-04-14  
**Status:** Approved

## Goal

Decouple semantic color identity from hex values in the cube model so that the rendered color theme can be switched at runtime without touching model data.

## Approach

Introduce a `ColorCode` type in the model layer and a `Theme` type in a new `themes` module. The model stores color codes; the renderer resolves them to hex via the active theme. Theme is held in React state in `App` and passed to `CubeRenderer` as a prop.

---

## Types (`src/types/cube.ts`)

Add `ColorCode`:

```ts
export type ColorCode = 'WHITE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'RED' | 'ORANGE';
```

Change `FaceColors` to use it:

```ts
export type FaceColors = Partial<Record<FaceKey, ColorCode>>;
```

---

## Theme file (`src/themes/themes.ts`) — new file

```ts
import type { ColorCode } from '../types/cube';

export type Theme = Record<ColorCode, string>; // ColorCode → CSS hex color

export const DEFAULT_THEME: Theme = {
  WHITE: '#ffffff',
  YELLOW: '#ffd500',
  GREEN: '#009b48',
  BLUE: '#0046ad',
  RED: '#b71234',
  ORANGE: '#ff5800',
};
```

Additional theme objects live in this file alongside `DEFAULT_THEME`.

---

## Model layer

### `src/model/cube.ts`

`SOLVED_COLORS` changes from `Record<string, string>` (face → hex) to `Record<FaceKey, ColorCode>` (face → color code):

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

`createSolvedCube()` and `getFaceColors()` are unchanged in logic — they already use `SOLVED_COLORS[face]`.

### `src/model/moves.ts`

`remapFaceColors` moves color values between face keys without inspecting them. No logic changes; the TypeScript types update automatically to `ColorCode`.

---

## Solver (`src/solver/layerByLayer.ts`)

All piece lookups use `SOLVED_COLORS` values as identifiers (e.g. `findCenter(cube, SOLVED_COLORS.U)`). After the model change these become `findCenter(cube, 'WHITE')` etc. String equality comparisons in `findCenter`, `findEdge`, `findCorner` continue to work correctly.

---

## Renderer (`src/components/CubeRenderer.tsx`)

`Props` gains `theme: Theme`.

`buildCubeGroup` gains a `theme` parameter and resolves color codes before creating materials:

```ts
function buildCubeGroup(model: CubeModel, theme: Theme): THREE.Group {
  for (const [faceKey, colorCode] of Object.entries(block.faceColors) as [FaceKey, ColorCode][]) {
    cubieGroup.add(new THREE.Mesh(getStickerGeom(faceKey), getStickerMat(theme[colorCode])));
  }
}
```

`getStickerMat(hex)` is unchanged — it still receives and caches by hex string.

The rebuild `useEffect` adds `theme` to its dependency array so a theme switch triggers a group rebuild (same cost as committing a move).

---

## App (`src/App.tsx`)

```ts
const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
```

`theme` is passed to `CubeRenderer`. A theme-switcher UI (e.g. dropdown or button group) calls `setTheme`.

---

## Files changed

| File                              | Change                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| `src/types/cube.ts`               | Add `ColorCode`; change `FaceColors` value type              |
| `src/themes/themes.ts`            | **New** — `Theme` type + `DEFAULT_THEME`                     |
| `src/model/cube.ts`               | `SOLVED_COLORS` values become `ColorCode`                    |
| `src/model/moves.ts`              | Type-only update to `remapFaceColors`                        |
| `src/components/CubeRenderer.tsx` | Accept `theme` prop; resolve color codes in `buildCubeGroup` |
| `src/App.tsx`                     | Hold `theme` state; pass to renderer; add theme-switcher UI  |

`src/solver/layerByLayer.ts` and `src/model/pieces.ts` require no changes — they work with whatever string values `SOLVED_COLORS` exposes.
