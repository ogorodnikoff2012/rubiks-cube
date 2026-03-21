import type { IAnimation } from './IAnimation';

interface AnimationContext {
  readonly startTime: number;
  readonly endTime: number;
  readonly animation: IAnimation;
}

/**
 * Drives a set of time-based animations via requestAnimationFrame.
 *
 * Lifecycle:
 *   start()  – begin the RAF loop; throws if already running
 *   stop()   – cancel the loop; call onEnd() for every registered animation,
 *              then clear all contexts; no-op if not running
 *   submit() – register an animation to run for `duration` milliseconds;
 *              calls onBegin() immediately; throws if the service is not running
 *
 * Guarantees per IAnimation contract: onBegin() is called in submit() and
 * onEnd() is called either when the animation expires during a tick or when
 * stop() is invoked, whichever comes first.
 */
export class AnimationService {
  private readonly contexts = new Set<AnimationContext>();
  private rafHandle: number | null = null;
  private running = false;

  start(): void {
    if (this.running) {
      throw new Error('AnimationService: already running — call stop() before start()');
    }
    this.running = true;
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    for (const ctx of this.contexts) {
      ctx.animation.onEnd();
    }
    this.contexts.clear();
  }

  submit(animation: IAnimation, duration: number): void {
    if (!this.running) {
      throw new Error('AnimationService: cannot submit to a stopped service');
    }
    const now = performance.now();
    animation.onBegin();
    this.contexts.add({
      startTime: now,
      endTime: now + duration,
      animation,
    });
  }

  private readonly tick = (timestamp: number): void => {
    const expired: AnimationContext[] = [];

    for (const ctx of this.contexts) {
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
