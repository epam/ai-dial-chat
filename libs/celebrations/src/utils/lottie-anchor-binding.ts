import type {
  LottieAnchorTarget,
  LottieStationBinding,
  LottieTrackBinding,
} from '../models/lottie-anchor-binding';
import type {
  LottieLayer,
  LottieProperty,
  Point,
} from '../models/lottie-composition';
import type { LottieNamespacedMarker } from '../models/lottie-markers';
import { findNamespacedRange } from './lottie-markers';

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

/* The range that holds `frame`, by the shared half-open rule. */
const rangeAt = (
  bindings: readonly LottieNamespacedMarker[],
  frame: number,
  name: string,
) =>
  findNamespacedRange(bindings, frame) ??
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

/** How one range moves a value: onto its anchor, mirrored by `side`. */
interface RangeMove {
  anchor: LottieAnchorTarget;
  reference: Point;
  side: 1 | -1;
}

const IDENTITY_SIDE = 1;
/* Share of the anchors' authored distance a track must cover to count as travelling across a stretch. */
const MIN_TRAVEL_SHARE = 0.25;

const applyMove = ({ anchor, reference, side }: RangeMove, value: number[]) => {
  const [x, y, ...rest] = value;
  return [
    anchor.point.x + side * (x - reference.x),
    anchor.point.y + (y - reference.y),
    ...rest,
  ];
};

const staticPoint = (layer: LottieLayer, name: string): number[] => {
  const position = layer.ks?.p;
  if (!position || position.a !== 0 || !isNumberList(position.k, 2))
    malformed(`"${name}" has no static position`);
  return position.k as number[];
};

const withScaleSign = (layer: LottieLayer, side: 1 | -1, name: string) => {
  const scale = layer.ks?.s;
  if (!scale) {
    if (side === 1) return layer.ks;
    return { ...layer.ks, s: { a: 0, k: [-100, 100, 100] } };
  }
  if (scale.a === 1) return undefined;
  if (!isNumberList(scale.k, 2)) malformed(`"${name}" has a malformed scale`);
  const [x, ...rest] = scale.k as number[];
  return { ...layer.ks, s: { a: 0, k: [side * x, ...rest] } };
};

/**
 * Returns `layers` with every track null's position keyframes retargeted:
 * a keyframe in a bind range keeps its authored offset from its anchor's
 * reference null, mirrored by the measured side; a keyframe in a stretch range
 * moves between the two neighbouring bind ranges in proportion to its own
 * track's progress across the range; a follow null moves rigidly with its anchor. Times, counts and easing are
 * unchanged, every other layer is returned as is, and the input is never mutated.
 */
export const bindTrackLayers = (
  layers: readonly LottieLayer[],
  {
    trackLayers,
    facingLayer,
    referencePrefix,
    followPrefix,
    bindings,
    stretches = [],
    anchors,
    holdsRest = false,
  }: LottieTrackBinding,
): LottieLayer[] => {
  const tracks = trackLayers.map((name) => findLayer(layers, name));
  if (facingLayer !== undefined && trackLayers.includes(facingLayer))
    malformed(`"${facingLayer}" is both a track and the facing`);
  const facingRoot =
    facingLayer === undefined
      ? undefined
      : findLayer(layers, facingLayer, false);
  const facing =
    facingRoot && facingLayer !== undefined
      ? keyframesOf(facingRoot.ks?.s, facingLayer)
      : undefined;
  facing?.forEach((keyframe, index) => {
    if (index < facing.length - 1 && keyframe.h !== 1)
      malformed(`"${facingLayer}" has a keyframe that does not hold`);
  });
  const positions = tracks.map((track, index) =>
    keyframesOf(track.ks?.p, trackLayers[index]),
  );
  positions.forEach((keyframes, index) => {
    for (const keyframe of keyframes)
      if (!isZero(keyframe.to) || !isZero(keyframe.ti))
        malformed(`"${trackLayers[index]}" has spatial tangents`);
  });
  const ranges = [...bindings, ...stretches];
  const references = new Map<string, Point>();
  const referenceOf = (anchorName: string) => {
    if (!references.has(anchorName))
      references.set(
        anchorName,
        referencePoint(layers, `${referencePrefix}${anchorName}`),
      );
    return references.get(anchorName) as Point;
  };
  /* Returns how a bind range moves, or `undefined` when its anchor is not
     measured because the chosen story never plays that range. */
  const bindMove = (range: LottieNamespacedMarker): RangeMove | undefined => {
    const anchorName = range.argument ?? malformed('a bind has no anchor');
    const anchor = anchors[anchorName];
    if (!anchor) return undefined;
    const side = anchor.side * (facing ? facingSignAt(facing, range.frame) : 1);
    return {
      anchor,
      reference: referenceOf(anchorName),
      side: side < 0 ? -1 : 1,
    };
  };
  /* A neighbour of a stretch whose anchor is not measured holds still. */
  const neighbourMove = (range: LottieNamespacedMarker): RangeMove => {
    const anchorName = range.argument ?? malformed('a bind has no anchor');
    const reference = referenceOf(anchorName);
    return (
      bindMove(range) ?? {
        anchor: { point: reference, side: IDENTITY_SIDE },
        reference,
        side: IDENTITY_SIDE,
      }
    );
  };
  const stretchMoves = (range: LottieNamespacedMarker) => {
    const end = range.frame + range.duration;
    const previous = bindings.find(
      ({ frame, duration }) => frame + duration === range.frame,
    );
    const next = bindings.find(({ frame }) => frame === end);
    if (!previous || !next)
      malformed(`the stretch at frame ${range.frame} is not between two binds`);
    const before = neighbourMove(previous);
    const after = neighbourMove(next);
    if (before.side !== after.side)
      malformed(`the stretch at frame ${range.frame} changes side`);
    return { before, after };
  };
  const isStretch = (range: LottieNamespacedMarker) =>
    stretches.includes(range);
  /* A track's own progress across a stretch range: 0 at its value where the
     range starts, 1 at its last value up to the next bind. A track that moves
     less than a quarter of the anchors' authored distance is not travelling
     between them, and stays with the bind before it. */
  const progressOf = (
    range: LottieNamespacedMarker,
    keyframes: readonly VectorKeyframe[] | undefined,
    x: number,
    span: number,
  ) => {
    if (!keyframes?.length) return 0;
    const end = range.frame + range.duration;
    const start =
      [...keyframes].reverse().find(({ t }) => t <= range.frame) ??
      keyframes[0];
    const finish =
      [...keyframes].reverse().find(({ t }) => t <= end) ??
      keyframes[keyframes.length - 1];
    const distance = finish.s[0] - start.s[0];
    /* A track that barely moves, or a range whose anchors share an x, holds with the bind before. */
    if (
      Math.abs(distance) < 1e-9 ||
      Math.abs(distance) < Math.abs(span) * MIN_TRAVEL_SHARE
    )
      return 0;
    return Math.min(1, Math.max(0, (x - start.s[0]) / distance));
  };
  /* Returns the moved value and its side, or `undefined` to keep the authored value. */
  const moveAt = (
    frame: number,
    value: number[],
    name: string,
    keyframes?: readonly VectorKeyframe[],
  ) => {
    const range = rangeAt(ranges, frame, name);
    if (!isStretch(range)) {
      const move = bindMove(range);
      return move && { value: applyMove(move, value), side: move.side };
    }
    const { before, after } = stretchMoves(range);
    const weight = progressOf(
      range,
      keyframes,
      value[0],
      after.reference.x - before.reference.x,
    );
    const from = applyMove(before, value);
    const to = applyMove(after, value);
    return {
      value: from.map((item, index) =>
        index < 2 ? item + (to[index] - item) * weight : item,
      ),
      side: before.side,
    };
  };

  const moved = new Map<LottieLayer, LottieLayer>();
  tracks.forEach((track, index) => {
    const name = trackLayers[index];
    const keyframes = positions[index];
    const movedPositions: VectorKeyframe[] = [];
    keyframes.forEach((keyframe, keyIndex) => {
      const previous = keyframes[keyIndex - 1];
      /* A resting object stays where it was put, whichever range the scene has moved on to. */
      if (
        holdsRest &&
        previous &&
        Math.abs(previous.s[0] - keyframe.s[0]) < 1e-6 &&
        Math.abs(previous.s[1] - keyframe.s[1]) < 1e-6
      ) {
        movedPositions.push({
          ...keyframe,
          s: [...movedPositions[keyIndex - 1].s],
        });
        return;
      }
      const move = moveAt(keyframe.t, keyframe.s, name, keyframes);
      movedPositions.push(move ? { ...keyframe, s: move.value } : keyframe);
    });
    const ks: LottieLayer['ks'] = {
      ...track.ks,
      p: { a: 1, k: movedPositions },
    };
    moved.set(track, { ...track, ks });
  });
  if (facingRoot && facing && facingLayer !== undefined) {
    const movedFacing = facing.map((keyframe) => {
      const range = rangeAt(ranges, keyframe.t, facingLayer);
      const side = isStretch(range)
        ? stretchMoves(range).before.side
        : bindMove(range)?.side;
      if (side === undefined) return keyframe;
      const [x, ...rest] = keyframe.s;
      return { ...keyframe, s: [side * x, ...rest] };
    });
    moved.set(facingRoot, {
      ...facingRoot,
      ks: { ...facingRoot.ks, s: { a: 1, k: movedFacing } },
    });
  }
  if (followPrefix !== undefined)
    for (const layer of layers) {
      const name = layer.nm;
      if (!name?.startsWith(followPrefix)) continue;
      const anchorName = name.slice(followPrefix.length);
      const anchor = anchors[anchorName];
      if (!anchor) continue;
      if (layer.ty !== 3) malformed(`"${name}" is not a null layer`);
      if (layer.parent !== undefined) malformed(`"${name}" has a parent`);
      const move = {
        anchor,
        reference: referenceOf(anchorName),
        side: anchor.side,
      };
      const ks = withScaleSign(layer, anchor.side, name);
      if (!ks) malformed(`"${name}" mirrors an animated scale`);
      moved.set(layer, {
        ...layer,
        ks: {
          ...ks,
          p: { a: 0, k: applyMove(move, staticPoint(layer, name)) },
        },
      });
    }
  return layers.map((layer) => moved.get(layer) ?? layer);
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
): LottieLayer[] =>
  bindTrackLayers(layers, {
    trackLayers: [positionLayer],
    facingLayer,
    referencePrefix,
    bindings,
    anchors,
  });
