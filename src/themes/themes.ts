import type { ColorCode } from '../types/cube';

/** Maps every ColorCode to a CSS hex color string. */
export type Theme = Record<ColorCode, string>;

/** Standard WCA competition colors. */
export const DEFAULT_THEME: Theme = {
  WHITE:  '#ffffff',
  YELLOW: '#ffd500',
  GREEN:  '#009b48',
  BLUE:   '#0046ad',
  RED:    '#b71234',
  ORANGE: '#ff5800',
};

/** High-contrast neon theme. */
export const NEON_THEME: Theme = {
  WHITE:  '#f0f0f0',
  YELLOW: '#ffe600',
  GREEN:  '#00ff88',
  BLUE:   '#00aaff',
  RED:    '#ff2244',
  ORANGE: '#ff8800',
};
