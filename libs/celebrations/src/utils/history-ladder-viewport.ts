import type { CornerRect } from '../models/composer-corner';
import type { HistoryLadderMetadata } from '../models/history-ladder';
import type {
  LottieLayer,
  LottieProperty,
  Point,
} from '../models/lottie-composition';
import {
  HistoryLadderMode,
  HistoryLadderViewportAnchor,
} from '../types/history-ladder';
import { cornerRectsIntersect } from './composer-corner-geometry';

/** One narrowly defined native line whose upper endpoint reaches the viewport. */
export const HISTORY_TOP_LINE = 'hl-if:drawn:top-line:row-0';

interface LinePath {
  v: number[][];
  i: number[][];
  o: number[][];
  c: boolean;
}

/** Rejects geometry that cannot safely be extended as one vertical line. */
export const validateHistoryTopLine = (
  layers: readonly LottieLayer[],
): void => {
  const lines = layers.filter(({ nm }) =>
    nm?.startsWith('hl-if:drawn:top-line:'),
  );
  if (!lines.length) return;
  const line = lines[0];
  const path = line.shapes?.[0];
  const value = path?.ks?.k as LinePath | undefined;
  const strokes = line.shapes?.slice(1) ?? [];
  const transform = line.ks;
  const identity = (name: 'p' | 'a' | 's', expected: number[]) =>
    transform?.[name]?.a === 0 &&
    JSON.stringify(transform[name]?.k) === JSON.stringify(expected);
  if (
    lines.length !== 1 ||
    line.nm !== HISTORY_TOP_LINE ||
    line.ty !== 4 ||
    line.parent !== layers.find(({ nm }) => nm === 'hl-follow:row-0')?.ind ||
    line.parent === undefined ||
    !identity('p', [0, 0, 0]) ||
    !identity('a', [0, 0, 0]) ||
    !identity('s', [100, 100, 100]) ||
    transform?.r?.a !== 0 ||
    transform.r.k !== 0 ||
    Object.keys(transform).some(
      (name) => !['p', 'a', 's', 'r', 'o'].includes(name),
    ) ||
    line.ef !== undefined ||
    line.masksProperties !== undefined ||
    line.ao === 1 ||
    path?.ty !== 'sh' ||
    path.ks?.a !== 0 ||
    !value ||
    value.c !== false ||
    !Array.isArray(value.v) ||
    value.v.length !== 2 ||
    value.v.some(
      (v) => !Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite),
    ) ||
    value.v[0][0] !== value.v[1][0] ||
    value.v[0][1] >= value.v[1][1] ||
    [value.i, value.o].some(
      (t) =>
        !Array.isArray(t) ||
        t.length !== 2 ||
        t.some(
          (v) => !Array.isArray(v) || v.length !== 2 || v.some((n) => n !== 0),
        ),
    ) ||
    strokes.length < 1 ||
    strokes.length > 2 ||
    strokes.some((stroke) => {
      const width = stroke.w as LottieProperty | undefined;
      return (
        stroke.ty !== 'st' ||
        width?.a !== 0 ||
        typeof width.k !== 'number' ||
        !Number.isFinite(width.k) ||
        width.k <= 0 ||
        width.k > 8
      );
    })
  )
    throw new TypeError('Invalid history ladder: invalid viewport top line');
};

/** Combines viewport edges with the last station, without scaling native art. */
export const historyViewportPoints = (
  points: Readonly<Record<string, Point>>,
  side: 1 | -1,
  viewport: CornerRect,
): Readonly<Record<string, Point>> => ({
  ...points,
  [HistoryLadderViewportAnchor.Start]: {
    x: side === 1 ? viewport.left : viewport.right,
    y: points['row-5'].y,
  },
  [HistoryLadderViewportAnchor.End]: {
    x: side === 1 ? viewport.right : viewport.left,
    y: points['row-5'].y,
  },
});

/** Extends only the declared endpoint on the private render composition. */
export const mapHistoryTopLine = (
  layers: LottieLayer[],
  viewport: CornerRect,
): void => {
  const line = layers.find(({ nm }) => nm === HISTORY_TOP_LINE);
  const path = line?.shapes?.[0].ks?.k as LinePath | undefined;
  const position = layers.find(({ ind }) => ind === line?.parent)?.ks?.p
    ?.k as number[];
  if (path) path.v[0][1] = viewport.top - position[1] - 4;
};

/** Checks the complete swept flight and extended rope against protected UI. */
export const isHistoryViewportRouteSafe = (
  metadata: HistoryLadderMetadata,
  mapped: readonly LottieLayer[],
  side: 1 | -1,
  viewport: CornerRect,
  protectedRects: readonly CornerRect[],
  mode: HistoryLadderMode,
): boolean => {
  const safe = (rect: CornerRect) => {
    const left = Math.max(rect.left, viewport.left);
    const right = Math.min(rect.right, viewport.right);
    const top = Math.max(rect.top, viewport.top);
    const bottom = Math.min(rect.bottom, viewport.bottom);
    return (
      left >= right ||
      top >= bottom ||
      !protectedRects.some((obstacle) =>
        cornerRectsIntersect(
          {
            left,
            right,
            top,
            bottom,
            width: right - left,
            height: bottom - top,
          },
          obstacle,
        ),
      )
    );
  };
  if (mode === HistoryLadderMode.Drawn) {
    const line = metadata.composition.layers.find(
      ({ nm }) => nm === HISTORY_TOP_LINE,
    );
    const path = line?.shapes?.[0].ks?.k as LinePath | undefined;
    if (path) {
      const position = mapped.find(({ ind }) => ind === line?.parent)?.ks?.p
        ?.k as number[];
      const x = position[0] + side * path.v[0][0];
      const bottom = position[1] + path.v[1][1];
      if (
        bottom < viewport.top ||
        !safe({
          left: x - 4,
          right: x + 4,
          top: viewport.top,
          bottom,
          width: 8,
          height: bottom - viewport.top,
        })
      )
        return false;
    }
  }
  const bounds = metadata.flightBounds;
  if (!bounds) return true;
  const track = mapped.find(({ nm }) => nm === 'hl-track:flight');
  const keys = track?.ks?.p?.k as { s: number[] }[];
  return keys.slice(1).every((key, index) => {
    const previous = keys[index].s;
    const left =
      Math.min(previous[0], key.s[0]) +
      Math.min(side * bounds.left, side * bounds.right);
    const right =
      Math.max(previous[0], key.s[0]) +
      Math.max(side * bounds.left, side * bounds.right);
    const top = Math.min(previous[1], key.s[1]) + bounds.top;
    const bottom = Math.max(previous[1], key.s[1]) + bounds.bottom;
    return safe({
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
    });
  });
};
