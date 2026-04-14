import type { ColorCode } from '../types/cube';

/** Maps every ColorCode to a CSS hex color string. */
export type Theme = Record<ColorCode, string>;

const WCA_THEME: Theme = {
  WHITE: '#ffffff',
  YELLOW: '#ffd500',
  GREEN: '#009b48',
  BLUE: '#0046ad',
  RED: '#b71234',
  ORANGE: '#ff5800',
};

const NEON_THEME: Theme = {
  WHITE: '#f0f0f0',
  YELLOW: '#ffe600',
  GREEN: '#00ff88',
  BLUE: '#00aaff',
  RED: '#ff2244',
  ORANGE: '#ff8800',
};

const PASTEL_THEME: Theme = {
  WHITE: '#f9c6d0',
  YELLOW: '#ffeaa7',
  GREEN: '#b5ead7',
  BLUE: '#c8b6e2',
  RED: '#ff9aa2',
  ORANGE: '#ffdac1',
};

const DARK_NEON_THEME: Theme = {
  WHITE: '#e0e0e0',
  YELLOW: '#1a1a1a',
  GREEN: '#39ff14',
  BLUE: '#0ff0fc',
  RED: '#ff073a',
  ORANGE: '#ff6600',
};

const OCEAN_THEME: Theme = {
  WHITE: '#caf0f8',
  YELLOW: '#ade8f4',
  GREEN: '#48cae4',
  BLUE: '#0077b6',
  RED: '#023e8a',
  ORANGE: '#00b4d8',
};

const SUNSET_THEME: Theme = {
  WHITE: '#fff3b0',
  YELLOW: '#ffb347',
  GREEN: '#ff6b6b',
  BLUE: '#8338ec',
  RED: '#c9184a',
  ORANGE: '#ff9f1c',
};

const FOREST_THEME: Theme = {
  WHITE: '#f0ebe3',
  YELLOW: '#e9c46a',
  GREEN: '#52796f',
  BLUE: '#264653',
  RED: '#e76f51',
  ORANGE: '#d4a373',
};

const BARBIE_THEME: Theme = {
  WHITE: '#ffe4f3',
  YELLOW: '#ffb3d9',
  GREEN: '#ff69b4',
  BLUE: '#ff1493',
  RED: '#c71585',
  ORANGE: '#ff85a1',
};

export const THEMES: { name: string; theme: Theme }[] = [
  { name: 'WCA', theme: WCA_THEME },
  { name: 'Neon', theme: NEON_THEME },
  { name: 'Pastel', theme: PASTEL_THEME },
  { name: 'Dark Neon', theme: DARK_NEON_THEME },
  { name: 'Ocean', theme: OCEAN_THEME },
  { name: 'Sunset', theme: SUNSET_THEME },
  { name: 'Forest', theme: FOREST_THEME },
  { name: 'Barbie', theme: BARBIE_THEME },
];

/** The default theme used on startup. */
export const DEFAULT_THEME = WCA_THEME;
