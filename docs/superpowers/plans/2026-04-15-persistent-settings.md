# Persistent Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the cube colour theme across page reloads via `localStorage`, using a React context to provide settings read-only to components.

**Architecture:** `App` owns all I/O (load from `localStorage` on mount, write on change). A thin `SettingsProvider` broadcasts the current `Settings` value via React context. `CubeRenderer` and `MovePair` drop their `theme` prop and read from context instead.

**Tech Stack:** TypeScript 5, React 18, `localStorage` API, Vite/ESLint/Prettier for verification.

---

## File Map

| Action | Path                               | Responsibility                                                                 |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------ |
| Create | `src/settings/settings.ts`         | `Settings` interface + `DEFAULT_SETTINGS` constant                             |
| Create | `src/settings/SettingsContext.tsx` | `SettingsProvider` component + `useSettings()` hook                            |
| Modify | `src/App.tsx`                      | Settings state, localStorage load/save, provider wrap, `MovePair` prop removal |
| Modify | `src/components/CubeRenderer.tsx`  | Drop `theme` prop, read from context                                           |

---

## Task 1: Create `src/settings/settings.ts`

**Files:**

- Create: `src/settings/settings.ts`

- [ ] **Step 1: Create the file**

```ts
import { DEFAULT_THEME, THEMES } from '../themes/themes';
import type { Theme } from '../themes/themes';

export interface Settings {
  themeName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  themeName: 'WCA',
};

/** Resolve a theme name to a Theme object, falling back to DEFAULT_THEME. */
export function resolveTheme(themeName: string): Theme {
  return THEMES.find((t) => t.name === themeName)?.theme ?? DEFAULT_THEME;
}
```

- [ ] **Step 2: Verify build passes**

```bash
yarn build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/settings/settings.ts
git commit -m "feat: add Settings type and resolveTheme helper"
```

---

## Task 2: Create `src/settings/SettingsContext.tsx`

**Files:**

- Create: `src/settings/SettingsContext.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS } from './settings';
import type { Settings } from './settings';

const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);

export function SettingsProvider({
  settings,
  children,
}: {
  settings: Settings;
  children: ReactNode;
}) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  return useContext(SettingsContext);
}
```

- [ ] **Step 2: Verify build passes**

```bash
yarn build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/settings/SettingsContext.tsx
git commit -m "feat: add SettingsProvider and useSettings hook"
```

---

## Task 3: Update `App.tsx` — settings state, localStorage, provider, `MovePair`

**Files:**

- Modify: `src/App.tsx`

This task:

1. Adds `Settings` state initialised from `localStorage`.
2. Writes to `localStorage` when settings change.
3. Wraps the render output in `<SettingsProvider>`.
4. Updates `MovePair` to read theme from context (removes its `theme` prop).
5. Removes `theme` from all `MovePair` call sites.

`CubeRenderer` still receives `theme` as a prop after this task — that is fixed in Task 4.

- [ ] **Step 1: Update imports at the top of `src/App.tsx`**

Replace:

```ts
import { DEFAULT_THEME, THEMES } from './themes/themes';
import type { Theme } from './themes/themes';
```

With:

```ts
import { THEMES } from './themes/themes';
import { DEFAULT_SETTINGS, resolveTheme } from './settings/settings';
import type { Settings } from './settings/settings';
import { SettingsProvider, useSettings } from './settings/SettingsContext';
```

- [ ] **Step 2: Update `MovePairProps` and `MovePair` component**

Replace the existing `MovePairProps` interface and `MovePair` function (lines 54–77 in the original file):

```tsx
interface MovePairProps {
  cw: MoveId;
  ccw: MoveId;
  onMove: (id: MoveId) => void;
}

function MovePair({ cw, ccw, onMove }: MovePairProps) {
  const { themeName } = useSettings();
  const theme = resolveTheme(themeName);
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
```

- [ ] **Step 3: Replace the `theme` state with `settings` state**

Replace:

```ts
const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
```

With:

```ts
const [settings, setSettings] = useState<Settings>(() => {
  try {
    const raw = localStorage.getItem('rubiks-cube-settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
});
```

- [ ] **Step 4: Derive `theme` from settings for use in App**

Immediately after the `settings` state declaration, add:

```ts
const theme = resolveTheme(settings.themeName);
```

- [ ] **Step 5: Update both theme `<select>` `onChange` handlers**

There are two `<select>` elements with a theme onChange handler (one in the mobile dropdown menu, one in the desktop header). Replace both occurrences of:

```tsx
onChange={(e) =>
  setTheme(
    THEMES.find((t) => t.name === e.target.value)?.theme || DEFAULT_THEME,
  )
}
```

and:

```tsx
onChange={(e) =>
  setTheme(THEMES.find((t) => t.name === e.target.value)?.theme || DEFAULT_THEME)
}
```

Both become:

```tsx
onChange={(e) => {
  const newSettings: Settings = { ...settings, themeName: e.target.value };
  setSettings(newSettings);
  localStorage.setItem('rubiks-cube-settings', JSON.stringify(newSettings));
}}
```

- [ ] **Step 6: Update both theme `<select>` `value` props**

Replace both occurrences of:

```tsx
value={THEMES.find((t) => t.theme === theme)?.name ?? THEMES[0].name}
```

With:

```tsx
value={settings.themeName}
```

- [ ] **Step 7: Remove `theme` prop from all `MovePair` call sites**

There are 9 `MovePair` usages in `App.tsx`. Remove `theme={theme}` from each. For example:

```tsx
// Before
<MovePair cw="U" ccw="U'" onMove={move} theme={theme} />
// After
<MovePair cw="U" ccw="U'" onMove={move} />
```

Apply to all 9 occurrences.

- [ ] **Step 8: Wrap the return value in `<SettingsProvider>`**

The `return (` in App currently returns a `<div>`. Wrap it:

```tsx
return (
  <SettingsProvider settings={settings}>
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ... all existing children unchanged ... */}
    </div>
  </SettingsProvider>
);
```

- [ ] **Step 9: Verify build passes**

```bash
yarn build
```

Expected: no TypeScript errors. (CubeRenderer still accepts `theme` prop — that's fine at this stage.)

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire settings state, localStorage persistence, and SettingsProvider in App"
```

---

## Task 4: Update `CubeRenderer.tsx` — drop `theme` prop, read from context

**Files:**

- Modify: `src/components/CubeRenderer.tsx`

- [ ] **Step 1: Add settings imports**

Add at the top of `src/components/CubeRenderer.tsx`, after the existing imports:

```ts
import { useSettings } from '../settings/SettingsContext';
import { resolveTheme } from '../settings/settings';
```

- [ ] **Step 2: Remove `theme` from the `Props` interface**

Replace:

```ts
interface Props {
  model: CubeModel;
  rotationRef: React.MutableRefObject<THREE.Quaternion>;
  animStateRef: React.MutableRefObject<AnimState>;
  theme: Theme;
}
```

With:

```ts
interface Props {
  model: CubeModel;
  rotationRef: React.MutableRefObject<THREE.Quaternion>;
  animStateRef: React.MutableRefObject<AnimState>;
}
```

- [ ] **Step 3: Update the component signature and derive theme from context**

Replace:

```ts
export default function CubeRenderer({ model, rotationRef, animStateRef, theme }: Props) {
```

With:

```ts
export default function CubeRenderer({ model, rotationRef, animStateRef }: Props) {
  const { themeName } = useSettings();
  const theme = resolveTheme(themeName);
```

- [ ] **Step 4: Remove `theme` from the `import type` line**

The existing import:

```ts
import type { Theme } from '../themes/themes';
```

is no longer needed (theme is now derived via `resolveTheme`). Remove that line.

- [ ] **Step 5: Remove `theme` prop from `CubeRenderer` call sites in `App.tsx`**

There are 3 `<CubeRenderer ... theme={theme} />` usages in `App.tsx`. Remove the `theme={theme}` prop from each:

```tsx
// Before
<CubeRenderer
  model={queue.cube}
  rotationRef={rotationRef}
  animStateRef={queue.animStateRef}
  theme={theme}
/>
// After
<CubeRenderer
  model={queue.cube}
  rotationRef={rotationRef}
  animStateRef={queue.animStateRef}
/>
```

Apply to all 3 occurrences.

- [ ] **Step 6: Remove unused `theme` import from `App.tsx`**

In `src/App.tsx`, remove `DEFAULT_THEME` and `Theme` references that are no longer used. The themes import line should now only import `THEMES`:

```ts
import { THEMES } from './themes/themes';
```

Also remove the `const theme = resolveTheme(settings.themeName);` line from App — `theme` is now only needed inside `MovePair` and `CubeRenderer`, not in App itself.

- [ ] **Step 7: Verify build and lint pass cleanly**

```bash
yarn build && yarn lint
```

Expected: no TypeScript errors, no lint warnings.

- [ ] **Step 8: Commit**

```bash
git add src/components/CubeRenderer.tsx src/App.tsx
git commit -m "feat: CubeRenderer reads theme from context, removes theme prop"
```

---

## Task 5: Format and final verification

**Files:** all modified files

- [ ] **Step 1: Run Prettier**

```bash
yarn format
```

- [ ] **Step 2: Verify build and lint are still clean**

```bash
yarn build && yarn lint
```

Expected: clean output.

- [ ] **Step 3: Commit formatting if any files changed**

```bash
git add src/settings/settings.ts src/settings/SettingsContext.tsx src/App.tsx src/components/CubeRenderer.tsx
git commit -m "style: format settings files"
```

(Skip if `yarn format` produced no changes.)

- [ ] **Step 4: Manual smoke test**

Start the dev server:

```bash
yarn dev
```

1. Open `http://localhost:5173/rubiks-cube/`.
2. Change the theme to something other than WCA (e.g. Neon).
3. Reload the page — the Neon theme should still be selected.
4. Open DevTools → Application → Local Storage → confirm `rubiks-cube-settings` key contains `{"themeName":"Neon"}`.
5. Change theme back to WCA, reload — WCA should be restored.
