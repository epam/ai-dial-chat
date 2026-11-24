import type { CornerRect } from '../models/composer-corner';
import type { LottieLayer } from '../models/lottie-composition';
import { cornerRectsIntersect } from './composer-corner-geometry';

interface CopyKey {
  t: number;
  s: number[];
}

const valueAt = (
  layer: LottieLayer,
  name: 'r' | 'o',
  index: number,
  fallback: number,
): number => {
  const property = layer.ks?.[name];
  if (!property) return fallback;
  if (property.a === 1) return (property.k as CopyKey[])[index].s[0];
  return Number(property.k);
};

/* Extrema of every corner over a bounded rotation interval, including turns
   between native keys. Translation is independently bounded by its endpoints;
   the contract accepts only monotone easing controls, so this is conservative. */
const rotationBounds = (
  width: number,
  height: number,
  side: 1 | -1,
  from: number,
  to: number,
) => {
  const lower = (Math.min(from, to) * Math.PI) / 180;
  const upper = (Math.max(from, to) * Math.PI) / 180;
  if (upper - lower >= Math.PI * 2) {
    const radius = Math.hypot(width, height);
    return { left: -radius, right: radius, top: -radius, bottom: radius };
  }
  const points: { x: number; y: number }[] = [];
  for (const [x, y] of [
    [0, 0],
    [-side * width, 0],
    [0, height],
    [-side * width, height],
  ]) {
    const angles = [lower, upper];
    for (const base of [Math.atan2(-y, x), Math.atan2(x, y)])
      for (
        let turn = Math.ceil((lower - base) / Math.PI);
        base + turn * Math.PI <= upper;
        turn++
      )
        angles.push(base + turn * Math.PI);
    for (const angle of angles)
      points.push({
        x: x * Math.cos(angle) - y * Math.sin(angle),
        y: x * Math.sin(angle) + y * Math.cos(angle),
      });
  }
  return {
    left: Math.min(...points.map(({ x }) => x)),
    right: Math.max(...points.map(({ x }) => x)),
    top: Math.min(...points.map(({ y }) => y)),
    bottom: Math.max(...points.map(({ y }) => y)),
  };
};

/** Checks the swept bounds of an upright DOM row following a mapped native track. */
export const isHistoryLadderCopyPathSafe = (
  track: LottieLayer,
  width: number,
  height: number,
  side: 1 | -1,
  viewport: CornerRect,
  protectedRects: readonly CornerRect[],
): boolean => {
  const keys = track.ks?.p?.k as CopyKey[];
  for (let index = 1; index < keys.length; index++) {
    if (
      valueAt(track, 'o', index - 1, 100) === 0 &&
      valueAt(track, 'o', index, 100) === 0
    )
      continue;
    const previous = keys[index - 1].s;
    const next = keys[index].s;
    const rotated = rotationBounds(
      width,
      height,
      side,
      valueAt(track, 'r', index - 1, 0),
      valueAt(track, 'r', index, 0),
    );
    const left = Math.min(previous[0], next[0]) + rotated.left;
    const right = Math.max(previous[0], next[0]) + rotated.right;
    const top = Math.min(previous[1], next[1]) + rotated.top;
    const bottom = Math.max(previous[1], next[1]) + rotated.bottom;
    const swept = {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
    };
    if (
      !Object.values(swept).every(Number.isFinite) ||
      left < viewport.left ||
      right > viewport.right ||
      top < viewport.top ||
      bottom > viewport.bottom ||
      protectedRects.some((rect) => cornerRectsIntersect(swept, rect))
    )
      return false;
  }
  return true;
};
