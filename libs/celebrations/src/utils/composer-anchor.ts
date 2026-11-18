import type { CelebrationComposerAnchorPlacement } from '../models/celebration-pack';
import type {
  LottieComposition,
  LottieLayer,
  Point,
} from '../models/lottie-composition';
import {
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
} from '../types/celebration-pack';
import {
  measureComposer,
  type ComposerBox,
  type ComposerSource,
} from './composer-target';

/** Name of the root null layer that carries the anchor mapping. */
export const COMPOSER_ANCHOR_LAYER_NAME = 'composer-anchor';

/* Synthetic anchor position: share of the viewport height and the margins kept free. */
const SYNTHETIC_TOP_SHARE = 0.57;
const SYNTHETIC_BOTTOM_MARGIN = 26;
const SIDE_MARGIN = 12;

/** How an anchored stage maps onto the viewport, measured once. */
export interface ComposerAnchorMapping {
  /** Uniform stage scale. */
  scale: number;
  /** Viewport box the stage's anchor rectangle maps onto. */
  box: ComposerBox;
  /** The measured composer; `null` for a synthetic anchor. */
  source: ComposerSource | null;
  /** Stage point that stays fixed: the anchor's center on the aligned edge. */
  pivot: Point;
  /** Viewport point the pivot maps onto. */
  origin: Point;
  /** Whether the stage is flipped horizontally around the pivot. */
  isMirrored: boolean;
  /** Viewport width in CSS pixels. */
  viewportWidth: number;
  /** Viewport height in CSS pixels. */
  viewportHeight: number;
}

type AnchorGeometry = Pick<
  CelebrationComposerAnchorPlacement,
  'anchorRect' | 'edge' | 'scale' | 'fallback'
>;

const clampScale = (width: number, { scale, anchorRect }: AnchorGeometry) =>
  Math.min(scale.max, Math.max(scale.min, width / anchorRect.width));

/* Viewport space the stage needs above a composer `height` px tall at scale
   `s`: the stage top lies `y·s` above the aligned top edge, or `(y + h)·s`
   above the aligned bottom edge. */
const headroomAbove = (
  { anchorRect, edge }: AnchorGeometry,
  s: number,
  height: number,
) =>
  edge === CelebrationAnchorEdge.Top
    ? anchorRect.y * s
    : (anchorRect.y + anchorRect.height) * s - height;

const pivotOf = ({ anchorRect, edge }: AnchorGeometry): Point => ({
  x: anchorRect.x + anchorRect.width / 2,
  y:
    edge === CelebrationAnchorEdge.Top
      ? anchorRect.y
      : anchorRect.y + anchorRect.height,
});

const originOf = (box: ComposerBox, edge: CelebrationAnchorEdge): Point => ({
  x: box.left + box.width / 2,
  y: edge === CelebrationAnchorEdge.Top ? box.top : box.top + box.height,
});

/**
 * Returns the synthetic `stage-anchor` box at `scale.min`, or `undefined`
 * when it does not fit the viewport.
 */
export const resolveSyntheticAnchorBox = (
  geometry: AnchorGeometry,
  viewportWidth: number,
  viewportHeight: number,
): ComposerBox | undefined => {
  const s = geometry.scale.min;
  const width = geometry.anchorRect.width * s;
  const height = geometry.anchorRect.height * s;
  if (width + SIDE_MARGIN * 2 > viewportWidth) return undefined;
  const lowest = viewportHeight - height - SYNTHETIC_BOTTOM_MARGIN;
  const highest = headroomAbove(geometry, s, height);
  if (highest > lowest) return undefined;
  return {
    left: (viewportWidth - width) / 2,
    top: Math.min(
      lowest,
      Math.max(highest, viewportHeight * SYNTHETIC_TOP_SHARE),
    ),
    width,
    height,
  };
};

/**
 * Measures the composer once and returns how the stage maps onto the
 * viewport; `undefined` means the scene shows its poster.
 */
export const resolveComposerAnchor = (
  geometry: AnchorGeometry,
  composerClass: string | undefined,
  isMirrored: boolean,
): ComposerAnchorMapping | undefined => {
  const { width, height, composer } = measureComposer(composerClass, {
    minWidth: geometry.anchorRect.width * geometry.scale.min,
    headroom: (rect) =>
      headroomAbove(geometry, clampScale(rect.width, geometry), rect.height),
  });
  const pivot = pivotOf(geometry);
  const common = {
    pivot,
    isMirrored,
    viewportWidth: width,
    viewportHeight: height,
  };
  if (composer)
    return {
      ...common,
      scale: clampScale(composer.box.width, geometry),
      box: composer.box,
      source: composer.source,
      origin: originOf(composer.box, geometry.edge),
    };
  if (geometry.fallback !== CelebrationAnchorFallback.StageAnchor)
    return undefined;
  const box = resolveSyntheticAnchorBox(geometry, width, height);
  if (!box) return undefined;
  return {
    ...common,
    scale: geometry.scale.min,
    box,
    source: null,
    origin: originOf(box, geometry.edge),
  };
};

const isComposition = (data: unknown): data is LottieComposition =>
  typeof data === 'object' &&
  data !== null &&
  Array.isArray((data as { layers?: unknown }).layers);

/**
 * Returns a deep copy of `data` whose root is the viewport and whose
 * top-level layers hang from one null layer carrying the anchor mapping.
 */
export const rebaseStageOntoViewport = (
  data: unknown,
  mapping: ComposerAnchorMapping,
): LottieComposition => {
  if (!isComposition(data)) throw new TypeError('Animation has no layers');
  const copy = JSON.parse(JSON.stringify(data)) as LottieComposition;
  const ind =
    copy.layers.reduce(
      (highest, layer) => Math.max(highest, layer.ind ?? 0),
      0,
    ) + 1;
  const { pivot, origin, scale, isMirrored } = mapping;
  const anchorLayer: LottieLayer = {
    ty: 3,
    ind,
    nm: COMPOSER_ANCHOR_LAYER_NAME,
    ip: copy.ip,
    op: copy.op,
    st: 0,
    sr: 1,
    ao: 0,
    ks: {
      a: { a: 0, k: [pivot.x, pivot.y, 0] },
      p: { a: 0, k: [origin.x, origin.y, 0] },
      s: { a: 0, k: [(isMirrored ? -1 : 1) * scale * 100, scale * 100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    },
  };
  for (const layer of copy.layers) if (layer.parent == null) layer.parent = ind;
  copy.layers.push(anchorLayer);
  copy.w = mapping.viewportWidth;
  copy.h = mapping.viewportHeight;
  return copy;
};
