import * as THREE from 'three';
import type { Block, CubeModel, FaceColors, FaceKey, ColorCode } from '../types/cube';

// --------------------------------------------------------------------------
// Move identifiers
// --------------------------------------------------------------------------

export type MoveId =
  | 'R'
  | "R'"
  | 'L'
  | "L'"
  | 'U'
  | "U'"
  | 'D'
  | "D'"
  | 'F'
  | "F'"
  | 'B'
  | "B'"
  | 'x'
  | "x'"
  | 'y'
  | "y'"
  | 'z'
  | "z'";

/** The 12 face-turn move identifiers, used for scramble generation. */
export const FACE_MOVES: MoveId[] = [
  'R',
  "R'",
  'L',
  "L'",
  'U',
  "U'",
  'D',
  "D'",
  'F',
  "F'",
  'B',
  "B'",
];

/** Maps each move to its inverse (undoing move M applies INVERSE_MOVE[M]). */
export const INVERSE_MOVE: Record<MoveId, MoveId> = {
  R: "R'",
  "R'": 'R',
  L: "L'",
  "L'": 'L',
  U: "U'",
  "U'": 'U',
  D: "D'",
  "D'": 'D',
  F: "F'",
  "F'": 'F',
  B: "B'",
  "B'": 'B',
  x: "x'",
  "x'": 'x',
  y: "y'",
  "y'": 'y',
  z: "z'",
  "z'": 'z',
};

/** Human-readable label pairs shown on the UI buttons. */
export const MOVE_PAIRS: Array<[MoveId, MoveId]> = [
  ['R', "R'"],
  ['L', "L'"],
  ['U', "U'"],
  ['D', "D'"],
  ['F', "F'"],
  ['B', "B'"],
];

// --------------------------------------------------------------------------
// Move specifications
// --------------------------------------------------------------------------

export interface MoveSpec {
  /** World-space rotation axis. */
  readonly axis: THREE.Vector3;
  /**
   * Rotation angle in radians.
   * Positive = CCW when looking from the +axis direction (right-hand rule).
   *
   * Derivation for standard notation (CW when looking at the face):
   *   R  = +90° around +x  (CW from right  = CCW from +x)
   *   L  = -90° around +x  (CW from left   = CW  from +x)
   *   U  = +90° around +y  (CW from top    = CCW from +y)
   *   D  = -90° around +y  (CW from bottom = CW  from +y)
   *   F  = -90° around +z  (CW from front  = CW  from +z)
   *   B  = +90° around +z  (CW from back   = CCW from +z)
   */
  readonly angle: number;
  /** Index into block.position that selects the affected slice. */
  readonly axisIndex: 0 | 1 | 2;
  /** Value of that component for affected blocks (+1 or -1). */
  readonly sliceValue: 1 | -1;
  /** If true, all blocks are affected (whole-cube rotation). */
  readonly allBlocks?: true;
}

const H = Math.PI / 2;

export const MOVE_SPECS: Record<MoveId, MoveSpec> = {
  R: { axis: new THREE.Vector3(1, 0, 0), angle: -H, axisIndex: 0, sliceValue: 1 },
  "R'": { axis: new THREE.Vector3(1, 0, 0), angle: H, axisIndex: 0, sliceValue: 1 },
  L: { axis: new THREE.Vector3(1, 0, 0), angle: H, axisIndex: 0, sliceValue: -1 },
  "L'": { axis: new THREE.Vector3(1, 0, 0), angle: -H, axisIndex: 0, sliceValue: -1 },
  U: { axis: new THREE.Vector3(0, 1, 0), angle: -H, axisIndex: 1, sliceValue: 1 },
  "U'": { axis: new THREE.Vector3(0, 1, 0), angle: H, axisIndex: 1, sliceValue: 1 },
  D: { axis: new THREE.Vector3(0, 1, 0), angle: H, axisIndex: 1, sliceValue: -1 },
  "D'": { axis: new THREE.Vector3(0, 1, 0), angle: -H, axisIndex: 1, sliceValue: -1 },
  F: { axis: new THREE.Vector3(0, 0, 1), angle: -H, axisIndex: 2, sliceValue: 1 },
  "F'": { axis: new THREE.Vector3(0, 0, 1), angle: H, axisIndex: 2, sliceValue: 1 },
  B: { axis: new THREE.Vector3(0, 0, 1), angle: H, axisIndex: 2, sliceValue: -1 },
  "B'": { axis: new THREE.Vector3(0, 0, 1), angle: -H, axisIndex: 2, sliceValue: -1 },
  // Whole-cube rotations (same axis/angle as the corresponding face move)
  x: { axis: new THREE.Vector3(1, 0, 0), angle: H, axisIndex: 0, sliceValue: 1, allBlocks: true },
  "x'": {
    axis: new THREE.Vector3(1, 0, 0),
    angle: -H,
    axisIndex: 0,
    sliceValue: 1,
    allBlocks: true,
  },
  y: { axis: new THREE.Vector3(0, 1, 0), angle: H, axisIndex: 1, sliceValue: 1, allBlocks: true },
  "y'": {
    axis: new THREE.Vector3(0, 1, 0),
    angle: -H,
    axisIndex: 1,
    sliceValue: 1,
    allBlocks: true,
  },
  z: { axis: new THREE.Vector3(0, 0, 1), angle: -H, axisIndex: 2, sliceValue: 1, allBlocks: true },
  "z'": {
    axis: new THREE.Vector3(0, 0, 1),
    angle: H,
    axisIndex: 2,
    sliceValue: 1,
    allBlocks: true,
  },
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

export const FACE_NORMALS: Record<FaceKey, THREE.Vector3> = {
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
};

/** Map a unit-axis-aligned vector back to its FaceKey. */
function vectorToFaceKey(v: THREE.Vector3): FaceKey {
  const x = Math.round(v.x);
  const y = Math.round(v.y);
  const z = Math.round(v.z);
  if (x === 1) return 'R';
  if (x === -1) return 'L';
  if (y === 1) return 'U';
  if (y === -1) return 'D';
  if (z === 1) return 'F';
  return 'B';
}

/**
 * Re-key faceColors through `rotation`: the sticker that was on face K is
 * now on whichever face K's normal points to after rotation.
 */
function remapFaceColors(faceColors: FaceColors, rotation: THREE.Quaternion): FaceColors {
  const result: FaceColors = {};
  for (const [key, color] of Object.entries(faceColors) as [FaceKey, ColorCode][]) {
    const rotatedNormal = FACE_NORMALS[key].clone().applyQuaternion(rotation);
    result[vectorToFaceKey(rotatedNormal)] = color;
  }
  return result;
}

function rleMoves(moves: MoveId[]): { move: MoveId; count: number }[] {
  const result: { move: MoveId; count: number }[] = [];

  for (const move of moves) {
    if (result.length === 0) {
      result.push({ move, count: 1 });
      continue;
    }

    const last = result[result.length - 1];
    if (last.move === move) {
      ++last.count;
      continue;
    }
    if (last.move === INVERSE_MOVE[move]) {
      --last.count;
      continue;
    }

    result.push({ move, count: 1 });
  }

  return result;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Expand `move` repeated `n` times into a minimal sequence of the same move
 * (mod 4). For example, `repeatMove('R', 3)` returns `["R'"]`.
 *
 * `n` may be negative or greater than 3; the result is always normalised to
 * the shortest equivalent sequence (0–2 forward copies, or one inverse).
 */
export function repeatMove(move: MoveId, n: number): MoveId[] {
  if (!Number.isInteger(n)) {
    throw new Error(`repeatMove: n must be an integer, got ${n}`);
  }
  n = ((n % 4) + 4) % 4;
  switch (n) {
    case 0:
      return [];
    case 1:
      return [move];
    case 2:
      return [move, move];
    case 3:
      return [INVERSE_MOVE[move]];
  }
  throw new Error(`Unreachable`);
}

/**
 * Simplify a move sequence by cancelling consecutive inverse pairs and
 * collapsing repeated identical moves (e.g. three R moves → R′).
 *
 * The result is semantically equivalent to the input but potentially shorter.
 * Note: this is a single-pass, greedy optimiser — it does not attempt global
 * cancellation across non-adjacent moves.
 */
export function optimizeMoves(moves: MoveId[]): MoveId[] {
  return rleMoves(moves)
    .map(({ move, count }) => repeatMove(move, count))
    .flat();
}

/** Returns the indices (into cube.blocks) of blocks that belong to `move`'s slice. */
export function getAffectedIndices(blocks: Block[], move: MoveId): number[] {
  const spec = MOVE_SPECS[move];
  if (spec.allBlocks) return blocks.map((_, i) => i);
  const { axisIndex, sliceValue } = spec;
  return blocks.reduce<number[]>((acc, b, i) => {
    if (b.position[axisIndex] === sliceValue) acc.push(i);
    return acc;
  }, []);
}

/**
 * Produce a new CubeModel with block positions and face-color maps updated
 * for `move`.  Per-block rotation fields are cleared (animation is done).
 */
export function applyMoveToModel(cube: CubeModel, move: MoveId): CubeModel {
  const spec = MOVE_SPECS[move];
  const { axis, angle, axisIndex, sliceValue } = spec;
  const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);

  const blocks: Block[] = cube.blocks.map((block) => {
    const affected = spec.allBlocks || block.position[axisIndex] === sliceValue;
    if (!affected) {
      // Not on this slice — only clear a stale animation rotation if present.
      if (!block.rotation) return block;
      const { rotation: _r, ...rest } = block;
      void _r;
      return rest;
    }

    const pos = new THREE.Vector3(...block.position).applyQuaternion(rotation);
    return {
      position: [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)] as [
        number,
        number,
        number,
      ],
      faceColors: remapFaceColors(block.faceColors, rotation),
      // rotation intentionally omitted → undefined
    };
  });

  return { ...cube, blocks };
}
