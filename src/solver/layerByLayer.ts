import { SOLVED_COLORS } from '../model/cube';
import {
  applyMoveToModel,
  INVERSE_MOVE,
  optimizeMoves,
  repeatMove,
} from '../model/moves';
import type { MoveId } from '../model/moves';
import type { CubeModel, FaceKey } from '../types/cube';
import { findCenter, findEdge } from '../model/pieces.ts';

export interface SolverStep {
  label: string;
  moves: MoveId[];
}

function ensure<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error(`value is undefined`);
  }
  return value;
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
  const whiteFace = findCenter(cube, SOLVED_COLORS.U)[0];

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
  const greenFace = findCenter(model, SOLVED_COLORS.F)[0];
  moves.push(...(greenToF[greenFace] ?? []));

  return moves;
}

function step1WhiteCross(cube: CubeModel): MoveId[] {
  const result: MoveId[] = [];
  const addMove = (...moves: MoveId[]) => {
    for (const m of moves) {
      result.push(m);
      cube = applyMoveToModel(cube, m);
      if (result.length >= 1000) {
        throw new Error("Internal error, infinite loop");
      }
    }
  };

  const shiftToFace: FaceKey[] = ['F', 'R', 'B', 'L'];
  const faceToShift: Partial<Record<FaceKey, number>> =
    Object.fromEntries(shiftToFace.map((face, shift) => [face, shift]));

  for (const frontColor of shiftToFace.map(face => SOLVED_COLORS[face])) {
    while (true) {
      const loc = findEdge(cube, SOLVED_COLORS.U, frontColor);

      if (loc[0] === 'U' && loc[1] === 'F') {
        break;
      }

      if (loc[0] == 'U') {
        const shift = ensure(faceToShift[loc[1]]);
        addMove(...repeatMove("U", shift));
        addMove("F");
        addMove(...repeatMove("U'", shift));
        addMove("F'");
        continue;
      }

      if (loc[0] === 'D') {
        const shift = ensure(faceToShift[loc[1]]);
        addMove(...repeatMove("D'", shift));
        addMove('F', 'F');
        continue;
      }

      if (loc[1] === 'U') {
        addMove(loc[0]);
        continue;
      }

      if (loc[1] === 'D') {
        const shift = ensure(faceToShift[loc[0]]);
        addMove(...repeatMove("D'", shift));
        addMove("D", "R", "F'", "R'");
        continue;
      }

      const shift = ensure(faceToShift[loc[1]]);
      const dir = (4 + ensure(faceToShift[loc[1]]) - ensure(faceToShift[loc[0]])) % 4;

      addMove(...repeatMove("U'", shift));
      addMove(dir === 1 ? loc[1] : INVERSE_MOVE[loc[1]]);
      addMove(...repeatMove("U", shift));
    }


    addMove("y'");
  }

  return optimizeMoves(result);
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function solveLayerByLayer(cube: CubeModel): SolverStep[] {
  const steps: [string, (cube: CubeModel) => MoveId[]][] = [
    ['Step 0: Cube Orientation', step0Orientation],
    ['Step 1: White Cross', step1WhiteCross],
  ];

  const result: SolverStep[] = [];

  for (const [label, fn] of steps) {
    const moves = fn(cube);
    result.push({ label, moves });
    for (const move of moves) {
      cube = applyMoveToModel(cube, move);
    }
  }

  return result;
}
