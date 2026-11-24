import type { CelebrationTextDirection } from '../models/celebration-pack';
import type { CornerRect } from './composer-corner-geometry';

const MAX_LONG_EDGE = 200;
const MIN_SHORT_EDGE = 96;
const MAX_PROTECTED_RECTS = 32;

const rectangle = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): CornerRect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
});

const isValidRectangle = (rect: CornerRect): boolean =>
  Object.values(rect).every(Number.isFinite) &&
  rect.width > 0 &&
  rect.height > 0 &&
  Math.abs(rect.right - rect.left - rect.width) < 0.000001 &&
  Math.abs(rect.bottom - rect.top - rect.height) < 0.000001;

const overlaps = (a: CornerRect, b: CornerRect): boolean =>
  Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
  Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);

/**
 * Fits a readable static image into bounded viewport/anchor-side candidates.
 * The supplied viewport already includes safety margins. No region may cover
 * protected content; failure leaves the host's existing notification alone.
 */
export const findComposerCornerPosterPlacement = (
  viewport: CornerRect,
  protectedRects: readonly CornerRect[],
  aspectRatio: number,
  direction: CelebrationTextDirection,
): CornerRect | null => {
  if (
    !Number.isFinite(aspectRatio) ||
    aspectRatio <= 0 ||
    !isValidRectangle(viewport) ||
    protectedRects.length > MAX_PROTECTED_RECTS ||
    protectedRects.some((rect) => !isValidRectangle(rect))
  )
    return null;

  const obstacles = protectedRects.filter((rect) => overlaps(viewport, rect));
  const regions = [viewport];
  for (const rect of obstacles) {
    regions.push(
      rectangle(
        viewport.left,
        viewport.top,
        viewport.right,
        Math.min(rect.top, viewport.bottom),
      ),
      rectangle(
        viewport.left,
        Math.max(rect.bottom, viewport.top),
        viewport.right,
        viewport.bottom,
      ),
      rectangle(
        viewport.left,
        viewport.top,
        Math.min(rect.left, viewport.right),
        viewport.bottom,
      ),
      rectangle(
        Math.max(rect.right, viewport.left),
        viewport.top,
        viewport.right,
        viewport.bottom,
      ),
    );
  }

  const naturalWidth = MAX_LONG_EDGE * Math.min(1, aspectRatio);
  const naturalHeight = MAX_LONG_EDGE / Math.max(1, aspectRatio);
  let best: CornerRect | null = null;
  for (const region of regions) {
    if (!isValidRectangle(region)) continue;
    const scale = Math.min(
      1,
      region.width / naturalWidth,
      region.height / naturalHeight,
    );
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    if (Math.min(width, height) < MIN_SHORT_EDGE) continue;
    const start = direction === 'rtl' ? region.right - width : region.left;
    const end = direction === 'rtl' ? region.left : region.right - width;
    const positions = [
      [end, region.top],
      [start, region.top],
      [end, region.bottom - height],
      [start, region.bottom - height],
      [
        region.left + (region.width - width) / 2,
        region.top + (region.height - height) / 2,
      ],
    ];
    for (const [left, top] of positions) {
      const candidate = rectangle(left, top, left + width, top + height);
      if (
        !obstacles.some((obstacle) => overlaps(candidate, obstacle)) &&
        (!best || candidate.width * candidate.height > best.width * best.height)
      )
        best = candidate;
    }
  }
  return best;
};
