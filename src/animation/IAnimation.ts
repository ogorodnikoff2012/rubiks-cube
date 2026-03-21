/**
 * Contract:
 *   - If an animation is submitted to AnimationService, onBegin() and onEnd()
 *     are both guaranteed to be called exactly once (even if the service is
 *     stopped before the first tick).
 *   - Between onBegin() and onEnd() there are zero or more onUpdate(p) calls
 *     with strictly increasing p ∈ [0, 1].
 */
export interface IAnimation {
  onBegin(): void;
  onUpdate(p: number): void;
  onEnd(): void;
}
