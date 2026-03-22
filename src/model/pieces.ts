import type { CubeModel, FaceKey } from '../types/cube';

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
 * Find the edge piece that carries `colA` and `colB`.
 *
 * Returns `[faceOfColA, faceOfColB]`, or `null` if no such piece exists
 * (which would indicate an invalid cube state).
 */
export function findEdge(cube: CubeModel, colA: string, colB: string): EdgeLocation | null {
  for (const block of cube.blocks) {
    const entries = Object.entries(block.faceColors) as [FaceKey, string][];
    if (entries.length !== 2) continue;
    const faceA = entries.find(([, c]) => c === colA)?.[0];
    const faceB = entries.find(([, c]) => c === colB)?.[0];
    if (faceA !== undefined && faceB !== undefined) return [faceA, faceB];
  }
  return null;
}

/**
 * Find the corner piece that carries `colA`, `colB`, and `colC`.
 *
 * Returns `[faceOfColA, faceOfColB, faceOfColC]`, or `null` if no such piece
 * exists.
 */
export function findCorner(
  cube: CubeModel,
  colA: string,
  colB: string,
  colC: string,
): CornerLocation | null {
  for (const block of cube.blocks) {
    const entries = Object.entries(block.faceColors) as [FaceKey, string][];
    if (entries.length !== 3) continue;
    const faceA = entries.find(([, c]) => c === colA)?.[0];
    const faceB = entries.find(([, c]) => c === colB)?.[0];
    const faceC = entries.find(([, c]) => c === colC)?.[0];
    if (faceA !== undefined && faceB !== undefined && faceC !== undefined)
      return [faceA, faceB, faceC];
  }
  return null;
}
