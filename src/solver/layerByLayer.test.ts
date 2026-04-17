import { describe, it, expect } from 'vitest';
import { createSolvedCube, SOLVED_COLORS } from '../model/cube';
import { applyMoveToModel, FACE_MOVES, INVERSE_MOVE, MOVE_SPECS } from '../model/moves';
import type { MoveId } from '../model/moves';
import { solveLayerByLayer } from './layerByLayer';
import type { CubeModel, FaceKey } from '../types/cube';

/** Minimal seeded LCG for reproducible scrambles. */
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 0x100000000;
  };
}

function scramble(cube: CubeModel, seed: number, numMoves: number): CubeModel {
  const rand = makePrng(seed);
  for (let i = 0; i < numMoves; i++) {
    const move = FACE_MOVES[Math.floor(rand() * FACE_MOVES.length)];
    cube = applyMoveToModel(cube, move);
  }
  return cube;
}

function applySolution(cube: CubeModel, steps: ReturnType<typeof solveLayerByLayer>): CubeModel {
  for (const step of steps) {
    for (const move of step.moves) {
      cube = applyMoveToModel(cube, move);
    }
  }
  return cube;
}

function isSolved(cube: CubeModel): boolean {
  const solved = createSolvedCube();
  const solvedMap = new Map(solved.blocks.map((b) => [b.position.join(','), b.faceColors]));
  for (const block of cube.blocks) {
    const expected = solvedMap.get(block.position.join(','));
    if (!expected) return false;
    for (const [face, color] of Object.entries(block.faceColors)) {
      if (expected[face as keyof typeof expected] !== color) return false;
    }
  }
  return true;
}

const FACE_POSITIONS: Record<FaceKey, [number, number, number]> = {
  R: [1, 0, 0], L: [-1, 0, 0], U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1],
};

function centerColor(cube: CubeModel, face: FaceKey): string {
  const [x, y, z] = FACE_POSITIONS[face];
  const block = cube.blocks.find(b => b.position[0] === x && b.position[1] === y && b.position[2] === z);
  return block?.faceColors[face] ?? '';
}

const ALL_MOVES = Object.keys(MOVE_SPECS) as MoveId[];

describe('single moves', () => {
  it('applying any move 4 times returns to solved state', () => {
    for (const move of ALL_MOVES) {
      let cube = createSolvedCube();
      for (let i = 0; i < 4; i++) cube = applyMoveToModel(cube, move);
      expect(isSolved(cube), `${move}^4 should be identity`).toBe(true);
    }
  });

  it('applying a move then its inverse returns to solved state', () => {
    for (const move of ALL_MOVES) {
      let cube = createSolvedCube();
      cube = applyMoveToModel(cube, move);
      cube = applyMoveToModel(cube, INVERSE_MOVE[move]);
      expect(isSolved(cube), `${move} then ${INVERSE_MOVE[move]} should be identity`).toBe(true);
    }
  });

  it('face moves only change blocks in their slice', () => {
    for (const move of FACE_MOVES) {
      const { axisIndex, sliceValue } = MOVE_SPECS[move];
      const before = createSolvedCube();
      const after = applyMoveToModel(before, move);

      for (let i = 0; i < before.blocks.length; i++) {
        const b = before.blocks[i];
        if (b.position[axisIndex] !== sliceValue) {
          expect(after.blocks[i].faceColors, `${move}: unaffected block at ${b.position} changed`).toEqual(b.faceColors);
        }
      }
    }
  });

  // Whole-cube rotation direction checks via center stickers.
  // x = same direction as R: U→F, F→D, D→B, B→U; L/R unchanged.
  it('x rotates U→F, F→D, D→B, B→U', () => {
    const cube = applyMoveToModel(createSolvedCube(), 'x');
    expect(centerColor(cube, 'F')).toBe(SOLVED_COLORS.U);
    expect(centerColor(cube, 'D')).toBe(SOLVED_COLORS.F);
    expect(centerColor(cube, 'B')).toBe(SOLVED_COLORS.D);
    expect(centerColor(cube, 'U')).toBe(SOLVED_COLORS.B);
    expect(centerColor(cube, 'R')).toBe(SOLVED_COLORS.R);
    expect(centerColor(cube, 'L')).toBe(SOLVED_COLORS.L);
  });

  // x' = same direction as R': U→B, B→D, D→F, F→U; L/R unchanged.
  it("x' rotates U→B, B→D, D→F, F→U", () => {
    const cube = applyMoveToModel(createSolvedCube(), "x'");
    expect(centerColor(cube, 'B')).toBe(SOLVED_COLORS.U);
    expect(centerColor(cube, 'D')).toBe(SOLVED_COLORS.B);
    expect(centerColor(cube, 'F')).toBe(SOLVED_COLORS.D);
    expect(centerColor(cube, 'U')).toBe(SOLVED_COLORS.F);
    expect(centerColor(cube, 'R')).toBe(SOLVED_COLORS.R);
    expect(centerColor(cube, 'L')).toBe(SOLVED_COLORS.L);
  });

  // y = same direction as U (CW from top): F→R, R→B, B→L, L→F; U/D unchanged.
  it('y rotates F→R, R→B, B→L, L→F', () => {
    const cube = applyMoveToModel(createSolvedCube(), 'y');
    expect(centerColor(cube, 'R')).toBe(SOLVED_COLORS.F);
    expect(centerColor(cube, 'B')).toBe(SOLVED_COLORS.R);
    expect(centerColor(cube, 'L')).toBe(SOLVED_COLORS.B);
    expect(centerColor(cube, 'F')).toBe(SOLVED_COLORS.L);
    expect(centerColor(cube, 'U')).toBe(SOLVED_COLORS.U);
    expect(centerColor(cube, 'D')).toBe(SOLVED_COLORS.D);
  });

  // y' = same direction as U': F→L, L→B, B→R, R→F; U/D unchanged.
  it("y' rotates F→L, L→B, B→R, R→F", () => {
    const cube = applyMoveToModel(createSolvedCube(), "y'");
    expect(centerColor(cube, 'L')).toBe(SOLVED_COLORS.F);
    expect(centerColor(cube, 'B')).toBe(SOLVED_COLORS.L);
    expect(centerColor(cube, 'R')).toBe(SOLVED_COLORS.B);
    expect(centerColor(cube, 'F')).toBe(SOLVED_COLORS.R);
    expect(centerColor(cube, 'U')).toBe(SOLVED_COLORS.U);
    expect(centerColor(cube, 'D')).toBe(SOLVED_COLORS.D);
  });

  // z = same direction as F (CW from front): U→R, R→D, D→L, L→U; F/B unchanged.
  it('z rotates U→R, R→D, D→L, L→U', () => {
    const cube = applyMoveToModel(createSolvedCube(), 'z');
    expect(centerColor(cube, 'R')).toBe(SOLVED_COLORS.U);
    expect(centerColor(cube, 'D')).toBe(SOLVED_COLORS.R);
    expect(centerColor(cube, 'L')).toBe(SOLVED_COLORS.D);
    expect(centerColor(cube, 'U')).toBe(SOLVED_COLORS.L);
    expect(centerColor(cube, 'F')).toBe(SOLVED_COLORS.F);
    expect(centerColor(cube, 'B')).toBe(SOLVED_COLORS.B);
  });

  // z' = same direction as F': U→L, L→D, D→R, R→U; F/B unchanged.
  it("z' rotates U→L, L→D, D→R, R→U", () => {
    const cube = applyMoveToModel(createSolvedCube(), "z'");
    expect(centerColor(cube, 'L')).toBe(SOLVED_COLORS.U);
    expect(centerColor(cube, 'D')).toBe(SOLVED_COLORS.L);
    expect(centerColor(cube, 'R')).toBe(SOLVED_COLORS.D);
    expect(centerColor(cube, 'U')).toBe(SOLVED_COLORS.R);
    expect(centerColor(cube, 'F')).toBe(SOLVED_COLORS.F);
    expect(centerColor(cube, 'B')).toBe(SOLVED_COLORS.B);
  });
});

describe('solveLayerByLayer', () => {
  const cases: Array<{ seed: number; numMoves: number }> = [
    { seed: 1, numMoves: 20 },
    { seed: 2, numMoves: 20 },
    { seed: 42, numMoves: 20 },
    { seed: 137, numMoves: 20 },
    { seed: 999, numMoves: 20 },
  ];

  for (const { seed, numMoves } of cases) {
    it(`solves a cube scrambled with seed=${seed}, ${numMoves} moves`, () => {
      const scrambled = scramble(createSolvedCube(), seed, numMoves);
      expect(isSolved(scrambled)).toBe(false);
      const steps = solveLayerByLayer(scrambled);
      const result = applySolution(scrambled, steps);
      expect(isSolved(result)).toBe(true);
    });
  }
});
