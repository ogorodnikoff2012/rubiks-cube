# Step 6: Yellow Corners Positioning — Design Spec

**Date:** 2026-04-13
**Feature:** Layer-by-layer solver step 6 — permute the four yellow corners into their correct slots (orientation ignored).

---

## Context

The layer-by-layer solver in `src/solver/layerByLayer.ts` currently implements steps 0–5:

| Step | Name                                    |
| ---- | --------------------------------------- |
| 0    | Cube orientation (white U, green F)     |
| 1    | White cross                             |
| 2    | White corners                           |
| 3    | Middle layer edges                      |
| 4    | Yellow cross (shape)                    |
| 5    | Ordered yellow cross (edge permutation) |

Step 4 flips the cube with `x x` so **yellow is on U** for steps 4–7. After step 5, the yellow cross edges are in their correct slots and the four yellow corners are in some even permutation of their correct slots.

Step 6 permutes the corners into the correct slots. Orientation (twist) is left to step 7.

---

## Algorithms

Two symmetric algorithms are used to keep y' rotations to at most 1 in all cases.

| Name    | Sequence              | Anchor slot |
| ------- | --------------------- | ----------- |
| `algoA` | `U R U' L' U R' U' L` | UBL         |
| `algoB` | `U L U' R' U L' U' R` | UFR         |

`algoB` is the **y2-conjugate** of `algoA` (R↔L swapped throughout). It fixes UFR — the slot diagonally opposite UBL — and cycles the remaining three corners in the symmetric direction.

Both are pure 3-cycles of the four U-layer corners. The exact anchor slots are confirmed empirically during implementation.

---

## Slot Correctness Check

After the `x x` flip, yellow = `SOLVED_COLORS.D`. Side center colors are read dynamically (since step 5 may have accumulated `y` rotations):

```ts
const yellow = SOLVED_COLORS.D;
const centerF = getFaceColors(cube, 'F', 'U')[1][1];
const centerR = getFaceColors(cube, 'R', 'U')[1][1];
// etc. for B, L
```

A corner is **correctly slotted** when `findCorner(cube, yellow, centerA, centerB)` returns a location whose face set equals `{U, faceA, faceB}` — regardless of which face each color sits on.

---

## Main Loop

The y' cycle for U-corner slots is `UFR→UFL→UBL→UBR→UFR`. With two anchors at UBL and UFR (diagonally opposite), each slot is at most 1 y' hop from one of the anchors:

| Correct corner at | y' rotations | Algorithm |
| ----------------- | ------------ | --------- |
| UBL               | 0            | algoA     |
| UFL               | 1 (UFL→UBL)  | algoA     |
| UFR               | 0            | algoB     |
| UBR               | 1 (UBR→UFR)  | algoB     |

```
while not all 4 corners correctly slotted (guard: 1000 moves):
  count correctly-slotted corners
  if 1 correct:
    if correct corner is at UBL or UFL:
      apply 0–1 y' to reach UBL, apply algoA
    else (UFR or UBR):
      apply 0–1 y' to reach UFR, apply algoB
  if 0 correct (double-swap):
    apply algoA once unconditionally
    (always produces ≥ 1 correctly-slotted corner; loop continues)
```

### Case analysis

| Permutation type | Correct slots before | Algorithm applications    |
| ---------------- | -------------------- | ------------------------- |
| Identity         | 4                    | 0                         |
| 3-cycle          | 1                    | 1 (at most 1 y' rotation) |
| Double-swap      | 0                    | ≤ 2                       |

All three are even permutations of A₄, covering every reachable state after steps 1–5.

---

## Architecture

- **Function signature:** `function step6YellowCornersPositioning(cube: CubeModel): MoveId[]`
- **Pattern:** identical to existing steps — local `addMove` helper, while-loop with 1000-move guard, `optimizeMoves` on result.
- **Registration:** added to the `steps` array in `solveLayerByLayer`, between step 5 and the future step 7.
- **Error handling:** the 1000-move guard throws `"Internal error, infinite loop"`, caught by the outer `try/catch` in `solveLayerByLayer` and surfaced as a solver failure label.

---

## What is NOT in scope

- Corner orientation (step 7, separate spec).
- Changes to any data structures, types, or model utilities.
- New test infrastructure — correctness verified via the existing manual scramble → solve → animate path.
