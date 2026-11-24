import type { CornerRect } from '../models/composer-corner';
import type { HistoryLadderMetadata } from '../models/history-ladder';
import type {
  LottieComposition,
  LottieLayer,
  LottieProperty,
  Point,
} from '../models/lottie-composition';
import {
  HistoryLadderAnchor,
  HistoryLadderMode,
  HistoryLadderTrack,
  HistoryLadderViewportAnchor,
} from '../types/history-ladder';
import { validateHistoryTopLine } from './history-ladder-viewport';
import { findNamespacedRange, readNamespacedMarkers } from './lottie-markers';
import { copyPathKeyframes } from './lottie-track-keyframes';

/** Static station names shared by authored assets and bounded host measurement. */
export const HISTORY_LADDER_ANCHORS = Object.values(HistoryLadderAnchor);
/** Namespace of the six native reference nulls. */
export const HISTORY_LADDER_REFERENCE_PREFIX = 'hl-anchor:';
/** Namespace of rigid native groups following one measured station. */
export const HISTORY_LADDER_FOLLOW_PREFIX = 'hl-follow:';
const isAnchorName = (name: string) =>
  HISTORY_LADDER_ANCHORS.some((anchor) => anchor === name);
/* The publication profile permits at most48 recursive layers; checking roots
   first also bounds every parent-chain walk on malformed external input. */
const MAX_ROOT_LAYERS = 48;

const METADATA_KEYS = new Set([
  'ty',
  'ind',
  'nm',
  'ks',
  'shapes',
  'ip',
  'op',
  'st',
  'sr',
  'ao',
  'ddd',
  'hd',
]);
const TRANSFORM_KEYS = new Set(['p', 'a', 's', 'r', 'o']);
const RECT_KEYS = new Set(['ty', 'nm', 'p', 's', 'r', 'd', 'hd']);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const onlyKeys = (value: Record<string, unknown>, keys: ReadonlySet<string>) =>
  Object.keys(value).every((key) => keys.has(key));

const malformed = (reason: string): never => {
  throw new TypeError(`Invalid history ladder: ${reason}`);
};

const staticValue = (property: LottieProperty | undefined): unknown => {
  if (
    !property ||
    property.a !== 0 ||
    !onlyKeys(
      property as unknown as Record<string, unknown>,
      new Set(['a', 'k']),
    )
  )
    return malformed('metadata must be static');
  return property.k;
};
const vector = (
  property: LottieProperty | undefined,
  length: number,
): number[] => {
  const value = staticValue(property);
  if (!Array.isArray(value) || value.length !== length || !value.every(finite))
    return malformed('invalid static vector');
  return value;
};
const identity = (layer: LottieLayer, allowPosition = false, opacity = 100) => {
  const transform = layer.ks ?? {};
  if (!onlyKeys(transform as Record<string, unknown>, TRANSFORM_KEYS))
    malformed(`unsupported transform on ${layer.nm}`);
  for (const [key, expected] of [
    ['a', [0, 0, 0]],
    ['s', [100, 100, 100]],
    ...(!allowPosition ? [['p', [0, 0, 0]]] : []),
  ] as const) {
    const property = transform[key as 'a' | 's' | 'p'];
    if (
      property &&
      vector(property, 3).some((value, index) => value !== expected[index])
    )
      malformed(`nonidentity ${key} on ${layer.nm}`);
  }
  if (transform.r && staticValue(transform.r) !== 0)
    malformed(`rotation on ${layer.nm}`);
  if (transform.o && staticValue(transform.o) !== opacity)
    malformed(`opacity on ${layer.nm}`);
};
const one = (layers: readonly LottieLayer[], name: string): LottieLayer => {
  const matches = layers.filter(({ nm }) => nm === name);
  if (matches.length !== 1) return malformed(`expected one ${name}`);
  return matches[0];
};
const metadataLayer = (layer: LottieLayer) => {
  if (
    !onlyKeys(layer, METADATA_KEYS) ||
    layer.parent !== undefined ||
    (layer.st !== undefined && layer.st !== 0) ||
    (layer.sr !== undefined && layer.sr !== 1) ||
    (layer.ddd !== undefined && layer.ddd !== 0) ||
    (layer.ao !== undefined && layer.ao !== 0) ||
    (layer.hd !== undefined && typeof layer.hd !== 'boolean')
  )
    malformed(`unsupported metadata on ${layer.nm}`);
};
const rectangle = (layer: LottieLayer): CornerRect => {
  metadataLayer(layer);
  identity(layer, false, 0);
  if (layer.ty !== 4 || layer.ks?.o === undefined || layer.shapes?.length !== 1)
    return malformed(`expected an invisible rectangle on ${layer.nm}`);
  const shape = layer.shapes[0];
  if (
    shape.ty !== 'rc' ||
    !onlyKeys(shape, RECT_KEYS) ||
    (shape.d !== undefined && shape.d !== 1 && shape.d !== 3) ||
    (shape.hd !== undefined && typeof shape.hd !== 'boolean') ||
    (shape.r && staticValue(shape.r) !== 0)
  )
    return malformed(`painted or transformed rectangle on ${layer.nm}`);
  const [x, y] = vector(shape.p, 2);
  const [width, height] = vector(shape.s, 2);
  if (width <= 0 || height <= 0 || width > 4096 || height > 4096)
    return malformed(`unbounded rectangle on ${layer.nm}`);
  return {
    left: x - width / 2,
    top: y - height / 2,
    right: x + width / 2,
    bottom: y + height / 2,
    width,
    height,
  };
};

interface PositionKey {
  t: number;
  s: number[];
  h?: number;
  o?: { x: number | number[]; y: number | number[] };
  i?: { x: number | number[]; y: number | number[] };
  to?: number[];
  ti?: number[];
}

const validateEasing = (key: PositionKey, isLast: boolean) => {
  if (Boolean(key.o) !== Boolean(key.i))
    malformed('easing handles must be paired');
  if (!isLast && key.h !== 1 && (!key.o || !key.i))
    malformed('nonhold keys require explicit easing');
  for (const easing of [key.o, key.i]) {
    if (!easing) continue;
    for (const control of [easing.x, easing.y]) {
      const values = Array.isArray(control) ? control : [control];
      if (
        !values.length ||
        values.some(
          (value) =>
            !finite(value) || value < 0 || value > 1 || value !== values[0],
        )
      )
        malformed('unsupported easing');
    }
  }
};

const keys = (layer: LottieLayer, end: number): PositionKey[] => {
  const position = layer.ks?.p;
  metadataLayer(layer);
  if (
    layer.ty !== 3 ||
    layer.shapes !== undefined ||
    layer.parent !== undefined ||
    position?.a !== 1 ||
    !onlyKeys(
      position as unknown as Record<string, unknown>,
      new Set(['a', 'k']),
    ) ||
    !Array.isArray(position.k) ||
    position.k.length < 2 ||
    position.k.length > 512
  )
    return malformed(`expected an unparented keyed track ${layer.nm}`);
  const result = position.k as PositionKey[];
  result.forEach((key, index) => {
    if (
      !record(key) ||
      !finite(key.t) ||
      key.t < 0 ||
      key.t > end ||
      (index > 0 && key.t <= result[index - 1].t) ||
      !Array.isArray(key.s) ||
      key.s.length < 2 ||
      key.s.length > 3 ||
      !key.s.every(finite) ||
      'e' in key ||
      (key.h !== undefined && key.h !== 1)
    )
      malformed(`invalid position key on ${layer.nm}`);
    if ([...(key.to ?? []), ...(key.ti ?? [])].some((value) => value !== 0))
      malformed(`spatial tangents on ${layer.nm}`);
    validateEasing(key, index === result.length - 1);
  });
  if (result[0].t !== 0 || result[result.length - 1].t !== end)
    malformed(`track ${layer.nm} must cover the timeline`);
  return result;
};

const scalarTrack = (
  layer: LottieLayer,
  name: 'r' | 'o',
  positions: readonly PositionKey[],
) => {
  const property = layer.ks?.[name];
  if (!property) return;
  if (
    !onlyKeys(
      property as unknown as Record<string, unknown>,
      new Set(['a', 'k']),
    )
  )
    malformed(`unsupported ${name} property`);
  const valid = (value: unknown) =>
    finite(value) &&
    (name === 'o' ? value >= 0 && value <= 100 : Math.abs(value) <= 360);
  if (property.a === 0) {
    if (!valid(property.k)) malformed(`invalid ${name} on ${layer.nm}`);
    return;
  }
  if (
    property.a !== 1 ||
    !Array.isArray(property.k) ||
    property.k.length !== positions.length
  )
    malformed(`invalid ${name} keys on ${layer.nm}`);
  (property.k as PositionKey[]).forEach((key, index) => {
    if (
      !record(key) ||
      key.t !== positions[index].t ||
      !Array.isArray(key.s) ||
      key.s.length !== 1 ||
      !valid(key.s[0]) ||
      'e' in key ||
      (key.h !== undefined && key.h !== 1)
    )
      malformed(`invalid ${name} key on ${layer.nm}`);
    validateEasing(key, index === positions.length - 1);
  });
};

/** Reads the strict generic contract without measuring or modifying any host UI. */
export const readHistoryLadderMetadata = (
  data: unknown,
): HistoryLadderMetadata => {
  if (
    !record(data) ||
    !finite(data.w) ||
    !finite(data.h) ||
    data.w <= 0 ||
    data.h <= 0 ||
    !finite(data.fr) ||
    data.fr <= 0 ||
    data.fr > 120 ||
    data.ip !== 0 ||
    !finite(data.op) ||
    data.op <= 0 ||
    data.tm !== undefined ||
    !Array.isArray(data.layers) ||
    data.layers.length > MAX_ROOT_LAYERS ||
    !data.layers.every(record)
  )
    return malformed('invalid composition');
  const composition = data as unknown as LottieComposition & { fr: number };
  const { layers, op: end } = composition;
  const hasFlight = layers.some(({ nm }) => nm === 'hl-track:flight');
  const trackKinds = [
    HistoryLadderTrack.Actor,
    HistoryLadderTrack.Copy,
    ...(hasFlight ? [HistoryLadderTrack.Flight] : []),
  ];
  const viewportAnchors = hasFlight
    ? Object.values(HistoryLadderViewportAnchor)
    : [];
  const referenceNames = [...HISTORY_LADDER_ANCHORS, ...viewportAnchors];
  const references: Record<string, Point> = {};
  const bounds: Record<string, CornerRect> = {};
  for (const name of referenceNames) {
    const reference = one(layers, `${HISTORY_LADDER_REFERENCE_PREFIX}${name}`);
    metadataLayer(reference);
    identity(reference, true);
    if (reference.ty !== 3 || reference.shapes !== undefined)
      malformed(`invalid reference ${name}`);
    const [x, y] = vector(reference.ks?.p, 3);
    references[name] = { x, y };
    if (isAnchorName(name))
      bounds[name] = rectangle(one(layers, `hl-bounds:${name}`));
  }
  HISTORY_LADDER_ANCHORS.forEach((name, index) => {
    if (
      index &&
      references[name].y <= references[HISTORY_LADDER_ANCHORS[index - 1]].y
    )
      malformed('references are not ordered');
  });
  const flightBounds = hasFlight
    ? rectangle(one(layers, 'hl-flight-bounds'))
    : undefined;
  if (!hasFlight && layers.some(({ nm }) => nm === 'hl-flight-bounds'))
    malformed('flight bounds without flight');
  validateHistoryTopLine(layers);
  const range = rectangle(one(layers, 'hl-range'));
  const drawnBounds = layers.some(({ nm }) => nm === 'hl-drawn-bounds')
    ? rectangle(one(layers, 'hl-drawn-bounds'))
    : undefined;
  if (
    range.width > 256 ||
    range.height > 256 ||
    range.left !== -range.width / 2 ||
    range.top !== -range.height / 2
  )
    malformed('invalid range limits');
  const markers = readNamespacedMarkers(
    data,
    {
      namespace: 'hl',
      kinds: {
        actor: {
          arguments: [
            ...HISTORY_LADDER_ANCHORS,
            ...viewportAnchors.filter(
              (name) => name === HistoryLadderViewportAnchor.End,
            ),
          ],
          duration: true,
          exclusive: true,
          maxPerScope: 64,
        },
        copy: {
          arguments: HISTORY_LADDER_ANCHORS,
          duration: true,
          exclusive: true,
          maxPerScope: 64,
        },
        ...(hasFlight
          ? {
              flight: {
                arguments: ['row-5', ...viewportAnchors],
                duration: true,
                exclusive: true,
                maxPerScope: 64,
              },
            }
          : {}),
        'edge-start': { duration: false },
        entry: { duration: false },
        restore: { duration: false },
      },
      order: ['entry', 'restore'],
    },
    { from: 0, to: end },
  )[0].markers;
  const bindings = {
    actor: markers.filter(({ kind }) => kind === 'actor'),
    copy: markers.filter(({ kind }) => kind === 'copy'),
    flight: markers.filter(({ kind }) => kind === 'flight'),
  };
  const startEdge = markers.find(({ kind }) => kind === 'edge-start');
  if (startEdge && startEdge.frame !== 0)
    malformed('edge selection must be at frame zero');
  const entry = markers.find(({ kind }) => kind === 'entry')?.frame;
  const restore = markers.find(({ kind }) => kind === 'restore')?.frame;
  if (
    entry === undefined ||
    restore === undefined ||
    entry < end * 0.01 ||
    restore <= entry ||
    restore + end * 0.04 > end
  )
    return malformed('invalid copy lifetime');
  for (const kind of trackKinds) {
    const windows = bindings[kind];
    if (
      !windows.length ||
      windows[0].frame !== 0 ||
      windows[windows.length - 1].frame +
        windows[windows.length - 1].duration !==
        end ||
      windows.some(
        (window, index) =>
          index > 0 &&
          window.frame !==
            windows[index - 1].frame + windows[index - 1].duration,
      )
    )
      malformed(`uncovered ${kind} timeline`);
  }
  const copyAnchor = findNamespacedRange(bindings.copy, entry)?.argument;
  const visibleFrom = entry - end * 0.01;
  const visibleTo = restore + end * 0.04;
  if (
    !copyAnchor ||
    bindings.copy.some(
      (window) =>
        window.frame < visibleTo &&
        window.frame + window.duration > visibleFrom &&
        window.argument !== copyAnchor,
    ) ||
    findNamespacedRange(bindings.copy, restore)?.argument !== copyAnchor
  )
    return malformed('copy changes its source anchor');
  const roots = new Set<number>();
  for (const kind of trackKinds) {
    const layer = one(layers, `hl-track:${kind}`);
    keys(layer, end);
    identity({
      ...layer,
      ks: {
        ...layer.ks,
        p: undefined,
        ...(kind === HistoryLadderTrack.Copy
          ? { r: undefined, o: undefined }
          : {}),
      },
    });
    if (typeof layer.ind !== 'number') malformed(`missing track index ${kind}`);
    roots.add(layer.ind as number);
  }
  for (const layer of layers.filter(({ nm }) =>
    nm?.startsWith(HISTORY_LADDER_FOLLOW_PREFIX),
  )) {
    metadataLayer(layer);
    const name = layer.nm?.slice(HISTORY_LADDER_FOLLOW_PREFIX.length) as string;
    if (
      !isAnchorName(name) ||
      layers.filter(({ nm }) => nm === layer.nm).length !== 1 ||
      layer.ty !== 3 ||
      layer.shapes !== undefined ||
      layer.parent !== undefined ||
      typeof layer.ind !== 'number'
    )
      malformed('invalid follower');
    identity(layer, true);
    vector(layer.ks?.p, 3);
    roots.add(layer.ind as number);
  }
  const byIndex = new Map<number, LottieLayer>();
  for (const layer of layers) {
    if (
      !Number.isSafeInteger(layer.ind) ||
      Number(layer.ind) < 0 ||
      byIndex.has(layer.ind as number) ||
      layer.tm !== undefined ||
      layer.tt !== undefined ||
      layer.td !== undefined ||
      layer.tp !== undefined ||
      (layer.st !== undefined && layer.st !== 0) ||
      (layer.sr !== undefined && layer.sr !== 1)
    )
      malformed('invalid layer identity or time remap');
    byIndex.set(layer.ind as number, layer);
  }
  const branches = new Set<HistoryLadderMode>();
  for (const layer of layers) {
    if (
      layer.nm?.startsWith('hl-track:') &&
      !trackKinds.some((kind) => layer.nm === `hl-track:${kind}`)
    )
      malformed('unknown position track');
    if (
      (layer.nm?.startsWith('hl-anchor:') ||
        layer.nm?.startsWith('hl-bounds:') ||
        layer.nm?.startsWith('hl-track:') ||
        layer.nm?.startsWith('hl-follow:') ||
        layer.nm === 'hl-range' ||
        layer.nm === 'hl-drawn-bounds' ||
        layer.nm === 'hl-flight-bounds') &&
      ((layer.ip !== undefined && layer.ip !== 0) ||
        (layer.op !== undefined && layer.op !== end))
    )
      malformed('metadata must span the composition');
    if (
      layer.nm?.startsWith(HISTORY_LADDER_REFERENCE_PREFIX) &&
      !referenceNames.some(
        (name) =>
          name === layer.nm?.slice(HISTORY_LADDER_REFERENCE_PREFIX.length),
      )
    )
      malformed('unknown reference');
    if (
      layer.nm?.startsWith('hl-bounds:') &&
      !isAnchorName(layer.nm.slice('hl-bounds:'.length))
    )
      malformed('unknown station bounds');
    for (const mode of Object.values(HistoryLadderMode))
      if (
        layer.nm === `hl-if:${mode}` ||
        layer.nm?.startsWith(`hl-if:${mode}:`)
      )
        branches.add(mode);
    if (
      layer.nm?.startsWith('hl-if:') &&
      !Object.values(HistoryLadderMode).some(
        (mode) =>
          layer.nm === `hl-if:${mode}` ||
          layer.nm?.startsWith(`hl-if:${mode}:`),
      )
    )
      malformed('unknown native branch');
    if (
      layer.nm?.startsWith('hl-bounds:') ||
      layer.nm === 'hl-range' ||
      layer.nm === 'hl-drawn-bounds' ||
      layer.nm === 'hl-flight-bounds' ||
      layer.nm?.startsWith(HISTORY_LADDER_REFERENCE_PREFIX) ||
      roots.has(layer.ind as number)
    )
      continue;
    let current: LottieLayer | undefined = layer;
    const seen = new Set<number>();
    while (current && !roots.has(current.ind as number)) {
      if (seen.has(current.ind as number)) malformed('cyclic layer parents');
      seen.add(current.ind as number);
      current =
        current.parent === undefined ? undefined : byIndex.get(current.parent);
    }
    if (!current) malformed(`unowned layer ${layer.nm}`);
  }
  if (!branches.has(HistoryLadderMode.Drawn))
    malformed('the complete drawn branch is required');
  const copy = one(layers, 'hl-track:copy');
  const copyKeys = keys(copy, end);
  scalarTrack(copy, 'r', copyKeys);
  scalarTrack(copy, 'o', copyKeys);
  const opacity = copy.ks?.o;
  const opacityKeys =
    opacity?.a === 1 ? (opacity.k as PositionKey[]) : undefined;
  const alphaAt = (index: number) =>
    opacityKeys?.[index].s[0] ?? Number(opacity?.k ?? 100);
  copyKeys.slice(0, -1).forEach((key, index) => {
    const hasVisibleSegment =
      key.h === 1
        ? alphaAt(index) > 0
        : alphaAt(index) > 0 || alphaAt(index + 1) > 0;
    if (
      hasVisibleSegment &&
      (key.t < visibleFrom - 1e-6 || copyKeys[index + 1].t > visibleTo + 1e-6)
    )
      malformed('copy visibility exceeds its borrowing window');
  });
  const entryKey = copyKeys.find(({ t }) => t === entry);
  if (
    !entryKey ||
    entryKey.s[0] !== references[copyAnchor].x ||
    entryKey.s[1] !== references[copyAnchor].y
  )
    malformed('copy entry is not its reference point');
  const frames = copyPathKeyframes(copy, {
    durationMs: (end / composition.fr) * 1000,
    frameRate: composition.fr,
    segments: [{ from: 0, to: end, localFrom: 0, localTo: end }],
    origin: references[copyAnchor],
    scale: 1,
  });
  const entryFrame = frames.find(({ offset }) => offset === entry / end);
  if (
    !entryFrame ||
    entryFrame.transform !== 'translate(0px, 0px) rotate(0deg)' ||
    entryFrame.opacity !== 1 ||
    frames[0].opacity !== 0 ||
    frames[frames.length - 1].opacity !== 0
  )
    malformed('invalid copy entry or visibility');
  return {
    composition,
    references,
    bounds,
    drawnBounds,
    flightBounds,
    useStartEdge: Boolean(startEdge),
    maxGap: range.height,
    maxDrift: range.width,
    bindings,
    copyAnchor,
    entry,
    restore,
  };
};
