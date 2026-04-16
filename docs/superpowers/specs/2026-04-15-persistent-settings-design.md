# Persistent Settings Storage — Design Spec

**Date:** 2026-04-15
**Status:** Approved

---

## Overview

Add a persistent settings layer backed by `localStorage`. The first (and currently only) setting is the cube colour theme. The design separates storage I/O (owned by `App`) from context provision (a thin React context carrier), so future settings can be added without restructuring and storage backends can be swapped for tests.

---

## Data shape

```ts
// src/settings/settings.ts

export interface Settings {
  themeName: string; // key into the THEMES array (e.g. 'WCA', 'Neon')
}

export const DEFAULT_SETTINGS: Settings = {
  themeName: 'WCA',
};
```

`themeName` is stored as a string key rather than a `Theme` object so the value is JSON-serialisable and stable across code changes.

---

## Context + Provider

```ts
// src/settings/SettingsContext.tsx

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

`SettingsProvider` is a pure context carrier — no I/O. `useSettings()` is the read-only consumer hook. There is no updater in the context value; write access stays in `App`.

---

## App integration

`App` owns all load/save logic:

1. **Load on mount** — `useState<Settings>` is initialised by parsing `localStorage.getItem('rubiks-cube-settings')` inside a `try/catch`; any parse failure or missing key falls back to `DEFAULT_SETTINGS`.
2. **Save on change** — the theme `<select>` `onChange` handler calls `setSettings({ ...settings, themeName })` and immediately writes `JSON.stringify(newSettings)` to `localStorage` under the key `'rubiks-cube-settings'`.
3. **Provider placement** — the top-level render wraps the full app body in `<SettingsProvider settings={settings}>`.
4. **Local theme derivation** — `App` derives the `Theme` object from `settings.themeName` for its own use (the theme select needs to know the current name to show the correct `<option>`).

---

## Component changes

| Component      | Before                       | After                                                 |
| -------------- | ---------------------------- | ----------------------------------------------------- |
| `CubeRenderer` | receives `theme: Theme` prop | calls `useSettings()`, derives theme from `themeName` |
| `MovePair`     | receives `theme: Theme` prop | calls `useSettings()`, derives theme from `themeName` |

The `theme` prop is removed from both component signatures. Call sites in `App` no longer pass it.

---

## File layout

```
src/
  settings/
    settings.ts          # Settings interface + DEFAULT_SETTINGS
    SettingsContext.tsx   # SettingsProvider + useSettings()
```

No other new files. `App.tsx`, `CubeRenderer.tsx` are modified.

---

## Error handling

- Malformed or missing `localStorage` data → silently falls back to `DEFAULT_SETTINGS`.
- Unknown `themeName` in storage → the theme lookup falls back to `DEFAULT_THEME` (same as today's default).

---

## Out of scope

- Migration of old storage formats (no prior storage exists).
- Settings UI beyond the existing theme select.
- Any setting other than `themeName`.
