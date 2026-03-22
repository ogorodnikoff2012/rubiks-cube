import { SOLVED_COLORS } from '../model/cube';
import { applyMoveToModel } from '../model/moves';
import type { MoveId } from '../model/moves';
import type { CubeModel, FaceKey } from '../types/cube';

export interface SolverStep {
  label: string;
  moves: MoveId[];
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Return the face key that the center piece of `color` currently sits on. */
function centerFace(cube: CubeModel, color: string): FaceKey {
  for (const block of cube.blocks) {
    const entries = Object.entries(block.faceColors) as [FaceKey, string][];
    if (entries.length === 1 && entries[0][1] === color) return entries[0][0];
  }
  throw new Error(`No center with color ${color}`);
}

// --------------------------------------------------------------------------
// Step 0 — Cube Orientation
// --------------------------------------------------------------------------

/**
 * Produce whole-cube turns (x / y / z) that orient the cube so that
 * white is on U and green is on F.
 */
function step0Orientation(cube: CubeModel): MoveId[] {
  const moves: MoveId[] = [];

  // ── 0a: bring white center to U ──────────────────────────────────────────
  const whiteToU: Partial<Record<FaceKey, MoveId[]>> = {
    U: [],
    D: ['x', 'x'],
    F: ["x'"],
    B: ['x'],
    R: ['z'],
    L: ["z'"],
  };
  const whiteFace = centerFace(cube, SOLVED_COLORS.U);
  const toTopMoves = whiteToU[whiteFace] ?? [];
  moves.push(...toTopMoves);

  // Simulate those moves so we can read the updated center positions.
  let model = cube;
  for (const m of toTopMoves) model = applyMoveToModel(model, m);

  // ── 0b: bring green center to F (y turns leave U / D untouched) ──────────
  const greenToF: Partial<Record<FaceKey, MoveId[]>> = {
    F: [],
    B: ['y', 'y'],
    R: ["y'"],
    L: ['y'],
  };
  const greenFace = centerFace(model, SOLVED_COLORS.F);
  moves.push(...(greenToF[greenFace] ?? []));

  return moves;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function solveLayerByLayer(cube: CubeModel): SolverStep[] {
  return [{ label: 'Step 0: Cube Orientation', moves: step0Orientation(cube) }];
}
