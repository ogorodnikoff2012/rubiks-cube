import type { Block, CubeModel, FaceColors, FaceKey, ColorCode } from '../types/cube';

/**
 * Standard solved-state face colors (WCA orientation).
 * Exported so solver code can reference colors by face name.
 */
export const SOLVED_COLORS: Record<FaceKey, ColorCode> = {
  U: 'WHITE',
  D: 'YELLOW',
  F: 'GREEN',
  B: 'BLUE',
  R: 'RED',
  L: 'ORANGE',
};

// --------------------------------------------------------------------------
// getFaceColors
// --------------------------------------------------------------------------

type Vec3 = [number, number, number];

/** Outward-pointing unit normals for each face. */
const FACE_NORMALS: Record<FaceKey, Vec3> = {
  F: [0, 0, 1],
  B: [0, 0, -1],
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
};

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Return the 3×3 grid of sticker colors for `face` as seen from outside the
 * cube when `upFace` is the face pointing toward the top of the 2-D view.
 *
 * ```
 * grid[row][col]   row 0 = top edge,  row 2 = bottom edge
 *                  col 0 = left edge, col 2 = right edge
 * ```
 * Both edges are measured from the viewer's perspective standing outside
 * `face` with `upFace` pointing upward.
 *
 * Example — standard front-face view:
 * ```ts
 * getFaceColors(cube, 'F', 'U')
 * // grid[0][0] is the top-left sticker of the green face
 * ```
 */
export function getFaceColors(cube: CubeModel, face: FaceKey, upFace: FaceKey): string[][] {
  const n = FACE_NORMALS[face];
  const up = FACE_NORMALS[upFace];
  // Viewer stands outside, looking inward along -n.
  // Camera right = viewDir × upDir = (-n) × up
  const right = cross([-n[0], -n[1], -n[2]], up);

  const grid: string[][] = [
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ];

  for (const block of cube.blocks) {
    const color = block.faceColors[face];
    if (color === undefined) continue;
    const p = block.position;
    const row = 1 - dot(p, up); // up-component: +1→row 0, -1→row 2
    const col = 1 + dot(p, right); // right-component: -1→col 0, +1→col 2
    grid[row][col] = color;
  }

  return grid;
}

// --------------------------------------------------------------------------
// createSolvedCube
// --------------------------------------------------------------------------

/**
 * Build the initial solved-state CubeModel.
 *
 * Coordinate system:
 *   x: -1 (left)  → +1 (right)
 *   y: -1 (bottom)→ +1 (top)
 *   z: -1 (back)  → +1 (front)
 */
export function createSolvedCube(): CubeModel {
  const blocks: Block[] = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // Skip the hidden core
        if (x === 0 && y === 0 && z === 0) continue;

        const faceColors: FaceColors = {};
        if (z === 1) faceColors.F = SOLVED_COLORS.F;
        if (z === -1) faceColors.B = SOLVED_COLORS.B;
        if (y === 1) faceColors.U = SOLVED_COLORS.U;
        if (y === -1) faceColors.D = SOLVED_COLORS.D;
        if (x === 1) faceColors.R = SOLVED_COLORS.R;
        if (x === -1) faceColors.L = SOLVED_COLORS.L;

        blocks.push({ position: [x, y, z], faceColors });
      }
    }
  }

  return { blocks };
}
