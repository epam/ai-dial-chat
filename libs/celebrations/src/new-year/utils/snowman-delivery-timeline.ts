/** A keyframed value: a scalar or a point. */
export type Vec = number[];

/** Cubic-Bézier timing control points, as in CSS `cubic-bezier()`. */
export type Bezier = readonly [number, number, number, number];

/** How a segment eases from one key to the next. */
export type Ease = 'linear' | 'hold' | Bezier;

/** Slow-in, slow-out for authored poses. */
export const EASE: Bezier = [0.42, 0, 0.58, 1];
/** Accelerating start, for drops and launches. */
export const EASE_IN: Bezier = [0.42, 0, 1, 1];
/** Decelerating finish, for settling. */
export const EASE_OUT: Bezier = [0, 0, 0.58, 1];

interface Key {
  t: number;
  v: Vec;
  ease: Ease;
}

/** Returns the eased progress of a cubic-Bézier timing curve at `x` ∈ [0, 1]. */
export const bezierProgress = ([x1, y1, x2, y2]: Bezier, x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const curve = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (curve(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return curve(y1, y2, (lo + hi) / 2);
};

/** One keyframed channel; the ease of a key shapes the segment that follows it. */
export class Track {
  readonly keys: Key[] = [];

  constructor(initial?: Vec) {
    if (initial) this.keys.push({ t: 0, v: initial, ease: EASE });
  }

  /** Sets the value at `t`, replacing a key at the same time. */
  set(t: number, v: Vec | number, ease: Ease = EASE): this {
    const value = typeof v === 'number' ? [v] : v;
    const at = this.keys.findIndex((key) => Math.abs(key.t - t) < 1e-6);
    if (at >= 0) this.keys[at] = { t, v: value, ease };
    else {
      this.keys.push({ t, v: value, ease });
      this.keys.sort((a, b) => a.t - b.t);
    }
    return this;
  }

  /** Holds the current value until `t`, then keeps going from there. */
  hold(t: number, ease: Ease = EASE): this {
    return this.set(t, this.value(t), ease);
  }

  /** The interpolated value at `t`. */
  value(t: number): Vec {
    const { keys } = this;
    if (!keys.length) return [0];
    if (t <= keys[0].t) return keys[0].v;
    const next = keys.findIndex((key) => key.t > t);
    if (next < 0) return keys[keys.length - 1].v;
    const from = keys[next - 1];
    const to = keys[next];
    if (from.ease === 'hold') return from.v;
    const x = (t - from.t) / (to.t - from.t);
    const p = from.ease === 'linear' ? x : bezierProgress(from.ease, x);
    return from.v.map((value, axis) => value + (to.v[axis] - value) * p);
  }

  /** Scalar value at `t`. */
  at(t: number): number {
    return this.value(t)[0];
  }

  /**
   * Replaces keys inside [t0, t1] with linear samples of `sample` on a grid
   * of about `step`, plus every time in `kinks`, so corners stay exact.
   */
  sample(
    t0: number,
    t1: number,
    step: number,
    sample: (t: number) => Vec,
    kinks: number[] = [],
  ): this {
    for (let i = this.keys.length - 1; i >= 0; i--) {
      const { t } = this.keys[i];
      if (t > t0 - 1e-6 && t < t1 + 1e-6) this.keys.splice(i, 1);
    }
    const count = Math.max(1, Math.ceil((t1 - t0) / step - 1e-6));
    const times = new Set<number>();
    for (let i = 0; i <= count; i++)
      times.add(i === count ? t1 : t0 + ((t1 - t0) * i) / count);
    for (const t of kinks) if (t > t0 && t < t1) times.add(t);
    for (const t of [...times].sort((a, b) => a - b))
      this.set(t, sample(t), 'linear');
    return this;
  }

  /**
   * Drops linear keys that a straight line between the kept keys of the same
   * linear run reproduces within `tolerance` (Douglas–Peucker over time), so
   * dense samples cost keys only where the motion bends.
   */
  prune(tolerance: number): this {
    const keep = new Set<number>();
    const simplify = (from: number, to: number) => {
      keep.add(from);
      keep.add(to);
      let worst = -1;
      let error = tolerance;
      const a = this.keys[from];
      const b = this.keys[to];
      for (let i = from + 1; i < to; i++) {
        const key = this.keys[i];
        const p = (key.t - a.t) / (b.t - a.t);
        const deviation = Math.max(
          ...key.v.map((value, axis) =>
            Math.abs(a.v[axis] + (b.v[axis] - a.v[axis]) * p - value),
          ),
        );
        if (deviation > error) {
          error = deviation;
          worst = i;
        }
      }
      if (worst > 0) {
        simplify(from, worst);
        simplify(worst, to);
      }
    };
    let start = 0;
    for (let i = 0; i < this.keys.length; i++) {
      const isRunEnd =
        i === this.keys.length - 1 || this.keys[i].ease !== 'linear';
      if (!isRunEnd) continue;
      simplify(start, i);
      start = i;
    }
    for (let i = this.keys.length - 1; i >= 0; i--)
      if (!keep.has(i)) this.keys.splice(i, 1);
    return this;
  }

  /** Whether any two keys differ, so the channel must be animated. */
  get isAnimated(): boolean {
    return this.keys.some((key) =>
      key.v.some(
        (value, axis) => Math.abs(value - this.keys[0].v[axis]) > 1e-9,
      ),
    );
  }
}
