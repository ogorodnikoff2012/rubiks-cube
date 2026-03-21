import type { EasingFn } from './easing';
import type { IAnimation } from './IAnimation';

/**
 * Wraps an IAnimation and remaps the progress value through an easing function
 * before forwarding it to the inner animation.
 *
 * All IAnimation contract guarantees are preserved: onBegin/onEnd are
 * forwarded unchanged; only the `p` argument of onUpdate is transformed.
 */
export class EasedAnimation implements IAnimation {
  constructor(
    private readonly inner: IAnimation,
    private readonly easing: EasingFn,
  ) {}

  onBegin(): void {
    this.inner.onBegin();
  }

  onUpdate(p: number): void {
    this.inner.onUpdate(this.easing(p));
  }

  onEnd(): void {
    this.inner.onEnd();
  }
}
