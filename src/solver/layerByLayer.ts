import { getFaceColors, SOLVED_COLORS } from '../model/cube';
import {
  applyMoveToModel,
  INVERSE_MOVE,
  optimizeMoves,
  repeatMove,
} from '../model/moves';
import type { MoveId } from '../model/moves';
import type { CubeModel, FaceKey } from '../types/cube';
import { findCenter, findCorner, findEdge } from '../model/pieces';

export interface SolverStep {
  label: string;
  moves: MoveId[];
}

function ensure<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected a value but got ${value}`);
  }
  return value;
}

function makeBitset(...flags: boolean[]): number {
  let result = 0;
  for (const flag of flags) {
    result <<= 1;
    if (flag) {
      result |= 1;
    }
  }
  return result;
}

function areCyclicShifts(lhs: number[], rhs: number[]): number {
  if (lhs.length !== rhs.length) {
    return -1;
  }
  for (let shift = 0; shift < lhs.length; ++shift) {
    let match = true;
    for (let i = 0; i < lhs.length; ++i) {
      if (lhs[(i + shift) % lhs.length] !== rhs[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return shift;
    }
  }
  return -1;
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

      if (loc[0] === 'U') {
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

function step2WhiteCorners(cube: CubeModel): MoveId[] {
  const result: MoveId[] = [];
  const addMove = (...moves: MoveId[]) => {
    for (const m of moves) {
      result.push(m);
      cube = applyMoveToModel(cube, m);
      if (result.length >= 1000) {
        throw new Error('Internal error, infinite loop');
      }
    }
  };

  const shiftToFace: FaceKey[] = ['F', 'R', 'B', 'L'];
  const faceToShift: Partial<Record<FaceKey, number>> = Object.fromEntries(
    shiftToFace.map((face, shift) => [face, shift]),
  );

  for (let i = 0; i < shiftToFace.length; ++i) {
    const frontColor = SOLVED_COLORS[shiftToFace[i]];
    const rightColor = SOLVED_COLORS[shiftToFace[(i + 1) % shiftToFace.length]];

    while (true) {
      const loc = findCorner(cube, SOLVED_COLORS.U, frontColor, rightColor);

      if (loc[0] === 'U' && loc[1] === 'F' && loc[2] === 'R') {
        break;
      }

      if (loc[0] === 'U') {
        addMove(loc[1], 'D', INVERSE_MOVE[loc[1]]);
        continue;
      }

      if (loc[0] === 'D') {
        const shift = ensure(faceToShift[loc[1]]);
        addMove(...repeatMove("D'", shift));
        addMove("R'", "D", "R");
        continue;
      }

      if (loc[1] === 'U') {
        addMove(INVERSE_MOVE[loc[0]], "D'", loc[0]);
        continue;
      }
      if (loc[2] === 'U') {
        addMove(loc[0], "D", INVERSE_MOVE[loc[0]]);
        continue;
      }
      if (loc[1] === 'D') {
        const shift = ensure(faceToShift[loc[2]]);
        addMove(...repeatMove("D'", shift));
        addMove("R'", "D", "R");
        continue;
      }
      if (loc[2] === 'D') {
        const shift = ensure(faceToShift[loc[1]]);
        addMove(...repeatMove("D'", shift));
        addMove("D", "F", "D'", "F'");
        continue;
      }

      throw new Error(`Unexpected location: [${loc[0]} ${loc[1]} ${loc[2]}]`);
    }

    addMove("y'");
  }

  return optimizeMoves(result);
}

function step3MiddleLayer(cube: CubeModel): MoveId[] {
  const result: MoveId[] = [];
  const addMove = (...moves: MoveId[]) => {
    for (const m of moves) {
      result.push(m);
      cube = applyMoveToModel(cube, m);
      if (result.length >= 1000) {
        throw new Error('Internal error, infinite loop');
      }
    }
  };

  const shiftToFace: FaceKey[] = ['F', 'R', 'B', 'L'];
  const faceToShift: Partial<Record<FaceKey, number>> = Object.fromEntries(
    shiftToFace.map((face, shift) => [face, shift]),
  );

  for (let i = 0; i < 4; ++i) {
    const frontColor = SOLVED_COLORS[shiftToFace[i]];
    const rightColor = SOLVED_COLORS[shiftToFace[(i + 1) % shiftToFace.length]];

    while (true) {
      const loc = findEdge(cube, frontColor, rightColor);

      if (loc[0] === 'U' || loc[1] === 'U') {
        throw new Error(`Unexpected location: [${loc[0]}, ${loc[1]}]`);
      }

      if (loc[0] === 'F' && loc[1] === 'R') {
        break;
      }

      if (loc[0] === 'D') {
        const shift = ensure(faceToShift[loc[1]]);
        addMove(...repeatMove("D'", shift));
        addMove("D", "D", "F", "D'", "F'", "D'", "R'", "D", "R");
        continue;
      }

      if (loc[1] === 'D') {
        const shift = ensure(faceToShift[loc[0]]);
        addMove(...repeatMove("D'", shift));
        addMove("D'", "R'", "D", "R", "D", "F", "D'", "F'");
        continue;
      }

      const frontShift = ensure(faceToShift[loc[0]]);
      const rightShift = ensure(faceToShift[loc[1]]);

      const shift = ((s1, s2) => {
        if (s2 < s1) {
          [s1, s2] = [s2, s1];
        }
        if (s1 === 0 && s2 === 3) {
          return 3;
        }
        return s1;
      })(frontShift, rightShift);

      addMove(...repeatMove("y'", shift));
      addMove("R'", "D", "R", "D", "F", "D'", "F'");
      addMove(...repeatMove("y", shift));
    }
    addMove("y'");
  }

  return optimizeMoves(result);
}

function step4YellowCross(cube: CubeModel): MoveId[] {
  const result: MoveId[] = [];
  const addMove = (...moves: MoveId[]) => {
    for (const m of moves) {
      result.push(m);
      cube = applyMoveToModel(cube, m);
      if (result.length >= 1000) {
        throw new Error('Internal error, infinite loop');
      }
    }
  };

  addMove("x", "x");

  const kUpColor = SOLVED_COLORS.D;
  while (true) {
    const upFace = getFaceColors(cube, 'U', 'B');

    const north = upFace[0][1] === kUpColor;
    const east = upFace[1][2] === kUpColor;
    const south = upFace[2][1] === kUpColor;
    const west = upFace[1][0] === kUpColor;

    const bitset = makeBitset(north, east, south, west);
    const NORTH = 8, EAST = 4, SOUTH = 2, WEST = 1, NONE = 0;

    if (bitset === (NORTH | EAST | SOUTH | WEST)) {
      break;
    }

    switch (bitset) {
      case NORTH | EAST:
        addMove("U'");
        break;
      case EAST | SOUTH:
        addMove("U", "U");
        break;
      case SOUTH | WEST:
        addMove("U");
        break;
      case NORTH | SOUTH:
      case EAST | WEST:
      case WEST | NORTH:
      case NONE:
        addMove("F", "U", "R", "U'", "R'", "F'");
        break;
      default:
        throw new Error(`Unexpected state: N:${north} E:${east} S:${south} W:${west}`);
    }
  }

  return optimizeMoves(result);
}

function step5OrderedYellowCross(cube: CubeModel): MoveId[] {
  const algorithm: MoveId[] = ["R", "U", "R'", "U", "R", "U", "U", "R'", "U"];

  const shiftToFace: FaceKey[] = ['F', 'R', 'B', 'L'];

  const expectedColors: string[] = [];
  const actualColors: string[] = [];

  for (const face of shiftToFace) {
    const faceColors = getFaceColors(cube, face, 'U');
    expectedColors.push(faceColors[1][1]);
    actualColors.push(faceColors[0][1]);
  }

  const actualToExpected = actualColors.map((color) => expectedColors.indexOf(color));

  {
    const shift = areCyclicShifts(actualToExpected, [0, 1, 2, 3]);
    if (shift >= 0) {
      return repeatMove("U", shift);
    }
  }

  for (let i = 0; i < 4; ++i) {
    const canonical = [0, 1, 2, 3];
    [canonical[i], canonical[(i + 3) % 4]] = [canonical[(i + 3) % 4], canonical[i]];

    const shift = areCyclicShifts(actualToExpected, canonical);

    if (shift >= 0) {
      return optimizeMoves([
        ...repeatMove("U", shift),
        ...repeatMove("y'", i),
        ...algorithm,
        ...repeatMove("y'", 4 - i),
      ]);
    }
  }

  {
    const shift = areCyclicShifts(actualToExpected, [3, 2, 1, 0]);
    if (shift >= 0) {
      return optimizeMoves([
        ...repeatMove("U", shift),
        ...algorithm,
        ...repeatMove("y'", 2),
        ...algorithm,
        ...repeatMove("y'", 2),
      ]);
    }
  }

  throw new Error(`Unexpected colors: [${actualColors.join(',')}]`)
}

// --------------------------------------------------------------------------
// Step 6 — Yellow Corners Positioning
// --------------------------------------------------------------------------

/**
 * Permute the four U-layer corners into their correct slots (ignoring twist).
 *
 * Uses two symmetric 3-cycle algorithms:
 *   algoA  (U R U' L' U R' U' L)  — fixes UBL, cycles the other three
 *   algoB  (U L U' R' U L' U' R)  — fixes UFR, y2-conjugate of algoA
 *
 * Any correctly-slotted corner is at most 1 y' rotation away from an anchor,
 * so the 1-correct case never needs more than one y' rotation.
 */
function step6YellowCornersPositioning(cube: CubeModel): MoveId[] {
  const result: MoveId[] = [];
  const addMove = (...moves: MoveId[]) => {
    for (const m of moves) {
      result.push(m);
      cube = applyMoveToModel(cube, m);
      if (result.length >= 1000) {
        throw new Error('Internal error, infinite loop');
      }
    }
  };

  // After step 4's `x x` flip, yellow is the original D-face colour.
  const yellow = SOLVED_COLORS.D;

  // algoA: fixes UBL, cycles UFL/UFR/UBR
  const algoA: MoveId[] = ["U", "R", "U'", "L'", "U", "R'", "U'", "L"];
  // algoB: fixes UFR, cycles UFL/UBL/UBR  (y2-conjugate: R↔L throughout)
  const algoB: MoveId[] = ["U", "L", "U'", "R'", "U", "L'", "U'", "R"];

  /** Color on the centre of `face` (read dynamically — y-rotations may have shifted centres). */
  function getCenterColor(face: FaceKey): string {
    return getFaceColors(cube, face, 'U')[1][1];
  }

  /**
   * True when the corner whose colours are {yellow, centerA, centerB} is
   * physically located in the slot formed by {U, faceA, faceB}, regardless
   * of which face each colour sits on (i.e. slot correct, orientation ignored).
   */
  function isCorrectSlot(faceA: FaceKey, faceB: FaceKey): boolean {
    const loc = findCorner(cube, yellow, getCenterColor(faceA), getCenterColor(faceB));
    return (
      (loc[0] === 'U' || loc[1] === 'U' || loc[2] === 'U') &&
      (loc[0] === faceA || loc[1] === faceA || loc[2] === faceA) &&
      (loc[0] === faceB || loc[1] === faceB || loc[2] === faceB)
    );
  }

  // The four U-corner slots expressed as [sideFaceA, sideFaceB] pairs.
  // Order matches the y' cycle: UFR → UFL → UBL → UBR → UFR
  // (y' moves the piece at each slot to the next slot in this list).
  const slots: [FaceKey, FaceKey][] = [
    ['F', 'R'], // UFR — algoB anchor
    ['F', 'L'], // UFL — 1 y' from algoA anchor
    ['B', 'L'], // UBL — algoA anchor
    ['B', 'R'], // UBR — 1 y' from algoB anchor
  ];

  while (true) {
    const correct = slots.filter(([a, b]) => isCorrectSlot(a, b));

    if (correct.length === 4) break;

    if (correct.length === 1) {
      const [a, b] = correct[0];
      // Route by which side face is L vs R:
      //   b === 'L'  →  UBL or UFL  →  use algoA (anchor UBL)
      //   b === 'R'  →  UFR or UBR  →  use algoB (anchor UFR)
      if (b === 'L') {
        if (a === 'F') addMove("y'"); // UFL → UBL (1 y' in the y' cycle)
        addMove(...algoA);
      } else {
        if (a === 'B') addMove("y'"); // UBR → UFR (1 y' in the y' cycle)
        addMove(...algoB);
      }
    } else {
      // 0 correct = double-swap.  One unconditional algoA application always
      // produces exactly 1 correctly-slotted corner; the loop then resolves it.
      addMove(...algoA);
    }
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
    ['Step 2: White Corners', step2WhiteCorners],
    ['Step 3: Middle Layer', step3MiddleLayer],
    ['Step 4: Yellow Cross', step4YellowCross],
    ['Step 5: Ordered Yellow Cross', step5OrderedYellowCross],
    ['Step 6: Yellow Corners Position', step6YellowCornersPositioning],
  ];

  const result: SolverStep[] = [];

  try {
    for (const [label, fn] of steps) {
      const moves = fn(cube);
      result.push({ label, moves });
      for (const move of moves) {
        cube = applyMoveToModel(cube, move);
      }
    }
  } catch (e) {
    result.push({
      label: "Failed to solve the cube: " + e,
      moves: [],
    });
  }

  return result;
}
