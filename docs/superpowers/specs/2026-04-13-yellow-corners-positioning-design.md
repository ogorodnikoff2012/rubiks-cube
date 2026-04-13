# Step 6: Yellow Corners Positioning — Design Spec

**Date:** 2026-04-13
**Feature:** Layer-by-layer solver step 6 — permute the four yellow corners into their correct slots (orientation ignored).

---

## Context

The layer-by-layer solver in `src/solver/layerByLayer.ts` currently implements steps 0–5:

| Step | Name |
|------|------|
| 0 | Cube orientation (white U, green F) |
| 1 | White cross |
| 2 | White corners |
| 3 | Middle layer edges |
| 4 | Yellow cross (shape) |
| 5 | Ordered yellow cross (edge permutation) |

Step 4 flips the cube with `x x` so **yellow is on U** for steps 4–7. After step 5, the yellow cross edges are in their correct slots and the four yellow corners are in some even permutation of their correct slots.

Step 6 permutes the corners into the correct slots. Orientation (twist) is left to step 7.

---

## Algorithm

```
U R U' L' U R' U' L
```

This is a well-known **pure 3-cycle of the four U-layer corners**. It leaves one slot (the **anchor**) undisturbed and cycles the remaining three. The exact anchor slot is confirmed empirically during implementation (expected: UBL).

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

```
while not all 4 corners correctly slotted (guard: 1000 moves):
  count correctly-slotted corners
  if 1 correct:
    apply y' 0–3 times to bring the correct corner to the anchor slot
    apply algorithm
  if 0 correct (double-swap):
    apply algorithm once unconditionally
    (this always produces ≥ 1 correctly-slotted corner; loop continues)
```

### Case analysis

| Permutation type | Correct slots before | Algorithm applications |
|-----------------|---------------------|----------------------|
| Identity | 4 | 0 |
| 3-cycle | 1 | 1 |
| Double-swap | 0 | ≤ 2 |

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
