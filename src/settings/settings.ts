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
