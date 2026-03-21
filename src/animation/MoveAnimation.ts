import * as THREE from 'three';
import type { CubeModel } from '../types/cube';
import type { IAnimation } from './IAnimation';

type CubeUpdater = (fn: (prev: CubeModel) => CubeModel) => void;

/**
 * Drives a single face-rotation move.
 *
 * On each update, the affected block.rotation fields are set to the
 * interpolated quaternion.  The renderer treats a non-null block.rotation
 * as an orbital rotation: both the cubie's world position and its orientation
 * are transformed, so the cubie orbits the cube centre rather than spinning
 * in place.
 *
 * On end, `finalize` is called as a functional state updater: it is expected
 * to commit the new block positions and face-color maps, and clear all
 * block.rotation fields.  `onComplete` is then called for any external
 * side-effects (e.g. clearing an "isAnimating" flag).
 */
export class MoveAnimation implements IAnimation {
  private readonly affected: Set<number>;

  constructor(
    affectedIndices: number[],
    private readonly targetRotation: THREE.Quaternion,
    private readonly setCube: CubeUpdater,
    private readonly finalize: (prev: CubeModel) => CubeModel,
    private readonly onComplete: () => void,
  ) {
    this.affected = new Set(affectedIndices);
  }

  onBegin(): void {}

  onUpdate(p: number): void {
    // Slerp from identity quaternion to targetRotation.
    const q = new THREE.Quaternion().slerp(this.targetRotation, p);
    this.setCube((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block, i) =>
        this.affected.has(i) ? { ...block, rotation: q } : block,
      ),
    }));
  }

  onEnd(): void {
    this.setCube(this.finalize);
    this.onComplete();
  }
}
