import type { CubeModel, FaceKey, ColorCode } from '../types/cube';

export type CenterLocation = [FaceKey];

/**
 * Location + orientation of an edge piece.
 *
 * `[faceA, faceB]` where `faceA` is the face the first requested color sits on
 * and `faceB` is the face the second requested color sits on.  The pair of face
 * keys also encodes position: the edge cubie lives at the intersection of those
 * two faces.
 */
export type EdgeLocation = [FaceKey, FaceKey];

/**
 * Location + orientation of a corner piece.
 *
 * `[faceA, faceB, faceC]` where each face key corresponds to the requested
 * color in the same ordinal position.  The triple fully encodes both position
 * (intersection of those three faces) and orientation.
 */
export type CornerLocation = [FaceKey, FaceKey, FaceKey];

/**
 * Find the center piece that carries `col`.
 *
 * Returns `[faceOfCol]`, or throws if no such piece exists (invalid cube state).
 */
export function findCenter(cube: CubeModel, col: ColorCode): CenterLocation {
  for (const block of cube.blocks) {
    const entries = Object.entries(block.faceColors) as [FaceKey, ColorCode][];
    if (entries.length !== 1) continue;
    const face = entries.find(([, c]) => c === col)?.[0];
    if (face !== undefined) return [face];
  }
  throw new Error(`Failed to find center piece [${col}]`);
}

/**
 * Find the edge piece that carries `colA` and `colB`.
 *
 * Returns `[faceOfColA, faceOfColB]`, or throws if no such piece exists
 * (which would indicate an invalid cube state).
 */
export function findEdge(cube: CubeModel, colA: ColorCode, colB: ColorCode): EdgeLocation {
  for (const block of cube.blocks) {
    const entries = Object.entries(block.faceColors) as [FaceKey, ColorCode][];
    if (entries.length !== 2) continue;
    const faceA = entries.find(([, c]) => c === colA)?.[0];
    const faceB = entries.find(([, c]) => c === colB)?.[0];
    if (faceA !== undefined && faceB !== undefined) return [faceA, faceB];
  }
  throw new Error(`Failed to find edge piece [${colA}, ${colB}]`);
}

/**
 * Find the corner piece that carries `colA`, `colB`, and `colC`.
 *
 * Returns `[faceOfColA, faceOfColB, faceOfColC]`, or throws if no such piece
 * exists (invalid cube state).
 */
export function findCorner(
  cube: CubeModel,
  colA: ColorCode,
  colB: ColorCode,
  colC: ColorCode,
): CornerLocation {
  for (const block of cube.blocks) {
    const entries = Object.entries(block.faceColors) as [FaceKey, ColorCode][];
    if (entries.length !== 3) continue;
    const faceA = entries.find(([, c]) => c === colA)?.[0];
    const faceB = entries.find(([, c]) => c === colB)?.[0];
    const faceC = entries.find(([, c]) => c === colC)?.[0];
    if (faceA !== undefined && faceB !== undefined && faceC !== undefined)
      return [faceA, faceB, faceC];
  }
  throw new Error(`Failed to find corner piece [${colA}, ${colB}, ${colC}]`);
}
