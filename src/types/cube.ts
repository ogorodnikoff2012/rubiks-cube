import type * as THREE from 'three';

/** The six face directions in standard Rubik's cube notation. */
export type FaceKey = 'F' | 'B' | 'U' | 'D' | 'L' | 'R';

/** Semantic color identity for a sticker — resolved to a hex value by the active Theme. */
export type ColorCode = 'WHITE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'RED' | 'ORANGE';

/** Per-face color map for a single block. Only exposed faces need an entry. */
export type FaceColors = Partial<Record<FaceKey, ColorCode>>;

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
