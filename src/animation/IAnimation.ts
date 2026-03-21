/**
 * Contract:
 *   - Any of the three methods may never be called at all.
 *   - If onBegin() is called, it is called exactly once.
 *   - After onBegin(), there are zero or more onUpdate(p) calls with
 *     strictly increasing p ∈ [0, 1].
 *   - After the last onUpdate(), onEnd() is called exactly once.
 */
export interface IAnimation {
  onBegin(): void;
  onUpdate(p: number): void;
  onEnd(): void;
}
