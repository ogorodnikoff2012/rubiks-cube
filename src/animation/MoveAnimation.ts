import * as THREE from 'three';
import type { CubeModel } from '../types/cube';
import type { IAnimation } from './IAnimation';

type CubeUpdater = (fn: (prev: CubeModel) => CubeModel) => void;

/**
 * Drives a single face-rotation move.
 *
 * `committedModel` is the fully-resolved cube state that should be installed
 * when the animation ends.  It must be computed *before* the animation is
 * submitted (i.e. by the caller, not inside a React state updater), so that
 * the next queued move can immediately read the correct block positions from
 * it without waiting for React to flush the state update.
 *
 * `onComplete` receives `committedModel` so the caller can propagate it to
 * wherever the next move will read its affected-block indices from.
 */
export class MoveAnimation implements IAnimation {
  private readonly affected: Set<number>;

  constructor(
    affectedIndices: number[],
    private readonly targetRotation: THREE.Quaternion,
    private readonly setCube: CubeUpdater,
    private readonly committedModel: CubeModel,
    private readonly onComplete: (committed: CubeModel) => void,
  ) {
    this.affected = new Set(affectedIndices);
  }

  onBegin(): void {}

  onUpdate(p: number): void {
    const q = new THREE.Quaternion().slerp(this.targetRotation, p);
    this.setCube((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block, i) =>
        this.affected.has(i) ? { ...block, rotation: q } : block,
      ),
    }));
  }

  onEnd(): void {
    // Install the precomputed committed model — no functional dependency on
    // the React-managed prev, so the update is always consistent.
    this.setCube(() => this.committedModel);
    this.onComplete(this.committedModel);
  }
}
