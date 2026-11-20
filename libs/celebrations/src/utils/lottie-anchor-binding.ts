import type { LottieStationBinding } from '../models/lottie-anchor-binding';
import type {
  LottieLayer,
  LottieProperty,
  Point,
} from '../models/lottie-composition';
import type { LottieNamespacedMarker } from '../models/lottie-markers';

/** A keyframe of a multi-dimensional Lottie property. */
interface VectorKeyframe {
  t: number;
  s: number[];
  [key: string]: unknown;
}

const malformed: (reason: string) => never = (reason) => {
  throw new Error(`Malformed station slot: ${reason}`);
};

const isNumberList = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) &&
  value.length >= length &&
  value.every((item) => typeof item === 'number' && Number.isFinite(item));

const isZero = (value: unknown) =>
  value === undefined ||
  (Array.isArray(value) && value.every((item) => item === 0));

/* Stations and reference nulls share the unparented coordinate space; the
   facing null may hang below the station null, since it only flips a sign. */
const findLayer = (
  layers: readonly LottieLayer[],
  name: string,
  isTopLevel = true,
) => {
  const matches = layers.filter((layer) => layer.nm === name);
  if (matches.length !== 1)
    malformed(`expected one "${name}" layer, found ${matches.length}`);
  const [layer] = matches;
  if (layer.ty !== 3) malformed(`"${name}" is not a null layer`);
  if (isTopLevel && layer.parent !== undefined)
    malformed(`"${name}" has a parent`);
  return layer;
};

const keyframesOf = (
  property: LottieProperty | undefined,
  name: string,
): VectorKeyframe[] => {
  if (!property || property.a !== 1 || !Array.isArray(property.k))
    malformed(`"${name}" is not keyframed`);
  const keyframes = property.k as unknown[];
  for (const keyframe of keyframes)
    if (
      typeof keyframe !== 'object' ||
      keyframe === null ||
      typeof (keyframe as VectorKeyframe).t !== 'number' ||
      !isNumberList((keyframe as VectorKeyframe).s, 2) ||
      'e' in keyframe
    )
      malformed(`"${name}" has a keyframe without a start value`);
  return keyframes as VectorKeyframe[];
};

/* The range that starts at or before `frame` and ends after it; a frame on a
   shared boundary belongs to the later range, the timeline's last one to its end. */
const rangeAt = (
  bindings: readonly LottieNamespacedMarker[],
  frame: number,
  name: string,
) =>
  bindings.find(
    ({ frame: start, duration }) => start <= frame && frame < start + duration,
  ) ??
  bindings.find(({ frame: start, duration }) => frame === start + duration) ??
  malformed(`"${name}" has an unbound keyframe at frame ${frame}`);

/** Returns the sign of the hold x-scale shown at `frame`: `1` facing +x, `-1` facing −x. */
export const facingSignAt = (
  facing: readonly { t: number; s: readonly number[] }[],
  frame: number,
): 1 | -1 => {
  let sign = Math.sign(facing[0]?.s[0] ?? 1);
  for (const keyframe of facing)
    if (keyframe.t <= frame) sign = Math.sign(keyframe.s[0]);
  return sign < 0 ? -1 : 1;
};

const referencePoint = (
  layers: readonly LottieLayer[],
  name: string,
): Point => {
  const position = findLayer(layers, name).ks?.p;
  if (!position || position.a !== 0 || !isNumberList(position.k, 2))
    malformed(`"${name}" has no static position`);
  const [x, y] = position.k as number[];
  return { x, y };
};

/**
 * Returns `layers` with the station keyframes moved onto measured anchors:
 * each position keyframe keeps its authored offset from its anchor's
 * reference null, mirrored when the measured side differs from the authored
 * one, and the facing flips with it. Keyframes of an unmeasured anchor stay
 * as authored, but every keyframe must lie in a bind range. Times, counts and
 * easing are unchanged; every other layer is returned as is, and the input is
 * never mutated.
 */
export const bindStationKeyframes = (
  layers: readonly LottieLayer[],
  {
    positionLayer,
    facingLayer,
    referencePrefix,
    bindings,
    anchors,
  }: LottieStationBinding,
): LottieLayer[] => {
  const root = findLayer(layers, positionLayer);
  const facingRoot = findLayer(layers, facingLayer, false);
  const positions = keyframesOf(root.ks?.p, positionLayer);
  const facing = keyframesOf(facingRoot.ks?.s, facingLayer);
  facing.forEach((keyframe, index) => {
    if (index < facing.length - 1 && keyframe.h !== 1)
      malformed(`"${facingLayer}" has a keyframe that does not hold`);
  });
  for (const keyframe of positions)
    if (!isZero(keyframe.to) || !isZero(keyframe.ti))
      malformed(`"${positionLayer}" has spatial tangents`);
  const references = new Map<string, Point>();
  /* Returns how a keyframe moves, or `undefined` when its anchor is not
     measured because the chosen story never plays that range. */
  const mirrorOf = (frame: number, name: string) => {
    const range = rangeAt(bindings, frame, name);
    const anchorName = range.argument ?? malformed('a bind has no anchor');
    const anchor = anchors[anchorName];
    if (!anchor) return undefined;
    if (!references.has(anchorName))
      references.set(
        anchorName,
        referencePoint(layers, `${referencePrefix}${anchorName}`),
      );
    const reference = references.get(anchorName) as Point;
    const side = anchor.side * facingSignAt(facing, range.frame);
    return { anchor, reference, side };
  };
  const movedPositions = positions.map((keyframe) => {
    const move = mirrorOf(keyframe.t, positionLayer);
    if (!move) return keyframe;
    const { anchor, reference, side } = move;
    const [x, y, ...rest] = keyframe.s;
    return {
      ...keyframe,
      s: [
        anchor.point.x + side * (x - reference.x),
        anchor.point.y + (y - reference.y),
        ...rest,
      ],
    };
  });
  const movedFacing = facing.map((keyframe) => {
    const move = mirrorOf(keyframe.t, facingLayer);
    if (!move) return keyframe;
    const [x, ...rest] = keyframe.s;
    return { ...keyframe, s: [move.side * x, ...rest] };
  });
  return layers.map((layer) => {
    if (layer === root)
      return { ...layer, ks: { ...layer.ks, p: { a: 1, k: movedPositions } } };
    if (layer === facingRoot)
      return { ...layer, ks: { ...layer.ks, s: { a: 1, k: movedFacing } } };
    return layer;
  });
};
