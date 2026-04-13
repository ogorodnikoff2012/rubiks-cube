import * as THREE from 'three';
import type { CubeModel } from '../types/cube';
import type { IAnimation } from './IAnimation';

type CubeUpdater = (fn: () => CubeModel) => void;

/**
 * Per-frame animation state shared with the renderer via a mutable ref.
 * null = no move animation in progress.
 */
export type AnimState = { indices: number[]; q: THREE.Quaternion } | null;

/**
 * Drives a single face-rotation move.
 *
 * `onFrame` is called every animation tick with the current interpolated
 * quaternion and the affected block indices.  The renderer reads this ref
 * directly and updates Three.js transforms without going through React state,
 * keeping the RAF loop free of React render overhead.
 *
 * `setCube` is called exactly once — in `onEnd` — to commit the final model.
 */
export class MoveAnimation implements IAnimation {
  private readonly affectedArray: number[];
  // Pre-allocated scratch objects reused every frame — avoids GC pressure
  // in the hot animation path (~60 allocations per move otherwise).
  private readonly scratchQ = new THREE.Quaternion();
  private readonly scratchState: NonNullable<AnimState>;

  constructor(
    affectedIndices: number[],
    private readonly targetRotation: THREE.Quaternion,
    private readonly onFrame: (state: AnimState) => void,
    private readonly setCube: CubeUpdater,
    private readonly committedModel: CubeModel,
    private readonly onComplete: (committed: CubeModel) => void,
  ) {
    this.affectedArray = affectedIndices;
    this.scratchState = { indices: this.affectedArray, q: this.scratchQ };
  }

  onBegin(): void {}

  onUpdate(p: number): void {
    this.scratchQ.identity().slerp(this.targetRotation, p);
    this.onFrame(this.scratchState);
  }

  onEnd(): void {
    // Lock to the exact final position so the renderer shows the correct
    // state for the few frames between this call and the React commit.
    this.scratchQ.copy(this.targetRotation);
    this.onFrame(this.scratchState);
    this.setCube(() => this.committedModel);
    this.onComplete(this.committedModel);
  }
}
