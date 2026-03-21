/** A function that maps a linear progress value p ∈ [0,1] to an eased value. */
export type EasingFn = (p: number) => number;

export const linear: EasingFn = (p) => p;

/** Quadratic ease-in: slow start, fast end. */
export const easeIn: EasingFn = (p) => p * p;

/** Quadratic ease-out: fast start, slow end. */
export const easeOut: EasingFn = (p) => p * (2 - p);

/** Quadratic ease-in-out: slow at both ends. */
export const easeInOut: EasingFn = (p) => (p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p);

/** Cubic ease-in-out: more pronounced slow-at-both-ends effect. */
export const easeInOutCubic: EasingFn = (p) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

/** Quartic ease-in-out: very sharp acceleration / deceleration. */
export const easeInOutQuart: EasingFn = (p) =>
  p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2;
