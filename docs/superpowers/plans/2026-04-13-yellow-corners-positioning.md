# Step 6: Yellow Corners Positioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `step6YellowCornersPositioning` to the layer-by-layer solver, permuting the four yellow U-layer corners into their correct slots (orientation ignored).

**Architecture:** A single function following the identical shape of existing solver steps — local `addMove` helper, a while-loop with a 1000-move guard, and `optimizeMoves` on the result. Two symmetric algorithms (algoA fixes UBL, algoB fixes UFR) eliminate the need for more than 1 `y'` rotation to position any correctly-slotted corner at an anchor.

**Tech Stack:** TypeScript 5, Vite 6, Yarn. No test runner — verification via `yarn build` (tsc strict) + `yarn lint` + manual dev server.

---

## File Structure

| File                         | Change                                                               |
| ---------------------------- | -------------------------------------------------------------------- |
| `src/solver/layerByLayer.ts` | Add `step6YellowCornersPositioning`; register in `solveLayerByLayer` |

No other files change.

---

### Task 1: Implement `step6YellowCornersPositioning`

**Files:**

- Modify: `src/solver/layerByLayer.ts` — insert new function before the `// Public API` comment block (line 411)

- [ ] **Step 1: Insert the function**

Add the following block immediately above the `// --------------------------------------------------------------------------` line that precedes `// Public API` (around line 411):

```ts
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
  const algoA: MoveId[] = ['U', 'R', "U'", "L'", 'U', "R'", "U'", 'L'];
  // algoB: fixes UFR, cycles UFL/UBL/UBR  (y2-conjugate: R↔L throughout)
  const algoB: MoveId[] = ['U', 'L', "U'", "R'", 'U', "L'", "U'", 'R'];

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
```

- [ ] **Step 2: Register the step in `solveLayerByLayer`**

In `src/solver/layerByLayer.ts`, find the `steps` array inside `solveLayerByLayer` (around line 416) and add the new entry after step 5:

```ts
const steps: [string, (cube: CubeModel) => MoveId[]][] = [
  ['Step 0: Cube Orientation', step0Orientation],
  ['Step 1: White Cross', step1WhiteCross],
  ['Step 2: White Corners', step2WhiteCorners],
  ['Step 3: Middle Layer', step3MiddleLayer],
  ['Step 4: Yellow Cross', step4YellowCross],
  ['Step 5: Ordered Yellow Cross', step5OrderedYellowCross],
  ['Step 6: Yellow Corners Position', step6YellowCornersPositioning],
];
```

- [ ] **Step 3: Build to verify types**

```bash
yarn build
```

Expected: zero TypeScript errors, Vite bundle succeeds.

- [ ] **Step 4: Lint**

```bash
yarn lint
```

Expected: no new warnings or errors.

- [ ] **Step 5: Commit**

```bash
git add src/solver/layerByLayer.ts
git commit -m "feat: add step 6 yellow corners positioning to LBL solver"
```

---

### Task 2: Manual verification

**Files:** none — runtime check only.

- [ ] **Step 1: Start dev server**

```bash
yarn dev
```

Open `http://localhost:5173`.

- [ ] **Step 2: Verify the identity case (no permutation needed)**

Click **Solve** on a freshly-opened solved cube. Step 6 should show `0 moves`.

- [ ] **Step 3: Verify the 3-cycle case**

Apply a scramble, then click **Solve**. Watch the animation through steps 0–6. After step 6 finishes, the four yellow corners should each be in their correct slots (yellow sticker on the same side as the yellow center; the two side stickers on the same sides as their matching center colors — orientation may still be wrong, that is expected).

- [ ] **Step 4: Verify the double-swap case**

To force a double-swap, apply only `R2 L2 U2` (two 180° moves) to a solved cube, then Solve. This is one of the easiest-to-construct double-swap states. Step 6 should complete without error and leave corners correctly positioned.

- [ ] **Step 5: Run a longer random scramble**

Use the **Scramble** button (which generates a random sequence). Solve multiple times to exercise different permutation cases. Step 6 should never produce a "Failed to solve" label.

- [ ] **Step 6: Commit verification note (no code change needed)**

No additional commit — verification is complete.
