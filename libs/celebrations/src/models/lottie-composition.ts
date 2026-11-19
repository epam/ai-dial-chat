/** A Lottie property: static (`a: 0`) or keyframed (`a: 1`). */
export interface LottieProperty {
  /** `1` when keyframed. */
  a: number;
  /** The value, or the keyframes. */
  k: unknown;
}

/** A Lottie transform; groups carry it as a `tr` shape item. */
export interface LottieTransform {
  /** Anchor point. */
  a?: LottieProperty;
  /** Position. */
  p?: LottieProperty;
  /** Scale, in percent. */
  s?: LottieProperty;
  /** Rotation, in degrees. */
  r?: LottieProperty;
  /** Opacity, in percent. */
  o?: LottieProperty;
  /** Skew. */
  sk?: LottieProperty;
  /** Skew axis. */
  sa?: LottieProperty;
}

/** A Lottie shape item; `it` holds a group's children. */
export interface LottieShape extends LottieTransform {
  /** Item type, such as `gr`, `sh`, `rc` or `tr`. */
  ty: string;
  /** Item name. */
  nm?: string;
  /** Children of a group. */
  it?: LottieShape[];
  /** Path (`sh`) data. */
  ks?: LottieProperty;
  [key: string]: unknown;
}

/** A Lottie layer. */
export interface LottieLayer {
  /** Layer type: `3` null, `4` shape, `0` precomposition. */
  ty: number;
  /** Layer index, referenced by `parent`. */
  ind?: number;
  /** Index of the parent layer. */
  parent?: number;
  /** Layer name. */
  nm?: string;
  /** In point, in frames. */
  ip?: number;
  /** Out point, in frames. */
  op?: number;
  /** Layer transform. */
  ks?: LottieTransform;
  /** Shapes of a shape layer. */
  shapes?: LottieShape[];
  [key: string]: unknown;
}

/** The root of a Lottie composition. */
export interface LottieComposition {
  /** Stage width. */
  w: number;
  /** Stage height. */
  h: number;
  /** In point, in frames. */
  ip: number;
  /** Out point, in frames. */
  op: number;
  /** Top-level layers, front to back. */
  layers: LottieLayer[];
  [key: string]: unknown;
}

/** A point in some coordinate space. */
export interface Point {
  /** Horizontal coordinate. */
  x: number;
  /** Vertical coordinate. */
  y: number;
}
