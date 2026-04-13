import * as THREE from 'three';
import type { IAnimation } from './IAnimation';

/**
 * Animates a quaternion rotation from `from` to `to` using spherical linear
 * interpolation (slerp).  On each update, the interpolated quaternion is
 * passed to `setFn` so the caller can apply it to whatever state they own.
 *
 * onEnd() guarantees the final value is exactly `to` regardless of floating-
 * point accumulation in the last onUpdate() call.
 */
export class RotationAnimation implements IAnimation {
  private readonly from: THREE.Quaternion;
  private readonly to: THREE.Quaternion;
  private readonly setFn: (q: THREE.Quaternion) => void;
  // Pre-allocated scratch quaternion reused every frame.
  private readonly scratchQ: THREE.Quaternion;

  constructor(from: THREE.Quaternion, to: THREE.Quaternion, setFn: (q: THREE.Quaternion) => void) {
    // Clone so the caller can mutate their quaternions freely after submission.
    this.from = from.clone();
    this.to = to.clone();
    this.setFn = setFn;
    this.scratchQ = from.clone();
  }

  onBegin(): void {
    // Nothing to set up; the first onUpdate(p≈0) will call setFn.
  }

  onUpdate(p: number): void {
    this.scratchQ.copy(this.from).slerp(this.to, p);
    this.setFn(this.scratchQ);
  }

  onEnd(): void {
    // Emit the exact target so floating-point drift doesn't leave us 1 frame off.
    this.scratchQ.copy(this.to);
    this.setFn(this.scratchQ);
  }
}
