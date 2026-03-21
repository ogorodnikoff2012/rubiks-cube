import type { IAnimation } from './IAnimation';

interface AnimationContext {
  readonly startTime: number;
  readonly endTime: number;
  readonly animation: IAnimation;
  /** Whether onBegin() has been called for this context. */
  begun: boolean;
}

/**
 * Drives a set of time-based animations via requestAnimationFrame.
 *
 * Lifecycle:
 *   start()  – begin the RAF loop (idempotent if already running)
 *   stop()   – cancel the loop; call onEnd() for every active animation that
 *              has already begun, then clear all contexts
 *   submit() – register an animation to run for `duration` milliseconds
 *
 * onBegin() is called on the first update frame for each animation so that
 * animations submitted but then discarded (via stop()) before they run
 * satisfy the IAnimation contract: if onBegin() was never called, neither
 * onUpdate() nor onEnd() need to be called.
 */
export class AnimationService {
  private readonly contexts = new Set<AnimationContext>();
  private rafHandle: number | null = null;

  start(): void {
    if (this.rafHandle !== null) return;
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    for (const ctx of this.contexts) {
      if (ctx.begun) ctx.animation.onEnd();
    }
    this.contexts.clear();
  }

  submit(animation: IAnimation, duration: number): void {
    const now = performance.now();
    this.contexts.add({
      startTime: now,
      endTime: now + duration,
      animation,
      begun: false,
    });
  }

  private readonly tick = (timestamp: number): void => {
    const expired: AnimationContext[] = [];

    for (const ctx of this.contexts) {
      if (!ctx.begun) {
        ctx.animation.onBegin();
        ctx.begun = true;
      }

      const total = ctx.endTime - ctx.startTime;
      const p = Math.min(1, (timestamp - ctx.startTime) / total);
      ctx.animation.onUpdate(p);

      if (p >= 1) expired.push(ctx);
    }

    for (const ctx of expired) {
      ctx.animation.onEnd();
      this.contexts.delete(ctx);
    }

    // Keep the loop alive as long as the service is running.
    this.rafHandle = requestAnimationFrame(this.tick);
  };
}
