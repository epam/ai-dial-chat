import {
  COPY_TRACK_ANCHOR_PREFIX,
  COPY_TRACK_CARD_REFERENCE,
  COPY_TRACK_FOLLOW_PREFIX,
  COPY_TRACK_IF_COPY_PREFIX,
  COPY_TRACK_IF_NO_COPY_PREFIX,
  COPY_TRACK_MIN_SUFFIX,
  COPY_TRACK_SECTION_SEPARATOR,
  COPY_TRACK_STRETCHABLE_ANCHORS,
  COPY_TRACK_TRACK_PREFIX,
} from '../constants/copy-track';
import type { CelebrationAnchors } from '../models/celebration';
import type {
  CelebrationComposerAnchorPlacement,
  CelebrationTextDirection,
} from '../models/celebration-pack';
import type { CopyTrackMarkers } from '../models/copy-track';
import type { CopyTrackPreparation } from '../models/copy-track-preparation';
import type { CopyTrackSpanReferences } from '../models/copy-track-stage';
import type { LottieAnchorTarget } from '../models/lottie-anchor-binding';
import type {
  LottieComposition,
  LottieLayer,
  LottieProperty,
  Point,
} from '../models/lottie-composition';
import type {
  LottieAnimationContext,
  LottiePlaybackStartContext,
} from '../models/lottie-scene';
import type { LottieTimeRemapSegment } from '../models/lottie-time-remap';
import {
  CopyTrackAnchor,
  CopyTrackRole,
  CopyTrackSectionKind,
  CopyTrackSlot,
} from '../types/copy-track';
import { PackSceneCompanionKind } from '../types/pack-scene';
import type { PackScenePreparation } from './celebration-pack-scene';
import {
  prepareCelebrationSnapshots,
  SNAPSHOT_HIDE_FADE_SHARE,
} from './celebration-snapshots';
import {
  rebaseStageOntoViewport,
  resolveComposerAnchor,
  type ComposerAnchorMapping,
} from './composer-anchor';
import { COPY_INTERACTION_EVENTS } from './copy-layers';
import { readCopyTrackMarkers } from './copy-track-markers';
import {
  chooseCopyTrackSection,
  measureCopyTrackHost,
} from './copy-track-stages';
import { bindTrackLayers } from './lottie-anchor-binding';
import { findNamespacedRange } from './lottie-markers';
import {
  buildSplicedPath,
  cycleCount,
  repeatCycle,
  toCompositionFrame,
  toLocalFrame,
  toTimeRemapProperty,
} from './lottie-time-remap';
import {
  COPY_RESTORE_SHARE,
  copyPathKeyframes,
  copyTravelKeyframes,
} from './lottie-track-keyframes';
import { observeSceneTargets } from './scene-targets';
import { findTextRun, prepareTextRunCopy } from './text-run-copy';

const COPY_LAYER_ATTRIBUTE = 'data-copy-track-copies';
const FRAME_EPSILON = 1e-6;

/** Host inputs the copy-track adapter prepares against, fixed at activation. */
export interface CopyTrackEnvironment {
  /** Host anchor class names. */
  anchors: CelebrationAnchors;
  /** Whether the host uses its mobile layout. */
  isMobile: boolean;
  /** The host's writing direction at activation; the story travels toward the inline end. */
  direction: CelebrationTextDirection;
}

interface Composition extends LottieComposition {
  fr: number;
  assets?: { id: string; layers?: LottieLayer[] }[];
  markers?: unknown[];
}

interface VectorKeyframe {
  t: number;
  s: number[];
  [key: string]: unknown;
}

const malformed: (reason: string) => never = (reason) => {
  throw new Error(`Malformed copy-track scene: ${reason}`);
};

/* A static point of a layer; a missing anchor point is the origin, a missing required position is malformed. */
const staticPoint = (
  layer: LottieLayer,
  key: 'a' | 'p',
  isRequired = false,
): Point => {
  const property = layer.ks?.[key];
  if (property === undefined) {
    if (isRequired) malformed(`"${layer.nm}" has no static ${key}`);
    return { x: 0, y: 0 };
  }
  if (property.a === 1 || !Array.isArray(property.k))
    malformed(`"${layer.nm}" has an animated ${key}`);
  const [x = 0, y = 0] = property.k as number[];
  return { x, y };
};

const isIdentity = (property: LottieProperty | undefined, identity: number) =>
  property === undefined ||
  (property.a !== 1 &&
    [property.k]
      .flat()
      .slice(0, 2)
      .every((value) => value === identity));

const single = (layers: readonly LottieLayer[], name: string) => {
  const matches = layers.filter(({ nm }) => nm === name);
  if (matches.length !== 1)
    malformed(`expected one "${name}" layer, found ${matches.length}`);
  return matches[0];
};

const keyframesOf = (layer: LottieLayer): VectorKeyframe[] => {
  const position = layer.ks?.p;
  if (position?.a !== 1) return [];
  return position.k as VectorKeyframe[];
};

/* Value of a linear or hold travel track at a composition frame. */
const travelAt = (
  keyframes: readonly VectorKeyframe[],
  frame: number,
): Point => {
  if (!keyframes.length) return { x: 0, y: 0 };
  let index = 0;
  while (index < keyframes.length - 1 && keyframes[index + 1].t <= frame)
    index++;
  const current = keyframes[index];
  const next = keyframes[index + 1];
  if (!next || current.h === 1 || frame <= current.t)
    return { x: current.s[0], y: current.s[1] };
  const share = (frame - current.t) / (next.t - current.t);
  return {
    x: current.s[0] + (next.s[0] - current.s[0]) * share,
    y: current.s[1] + (next.s[1] - current.s[1]) * share,
  };
};

const rectangleOf = (layer: LottieLayer) => {
  const rectangle = (layer.shapes ?? [])
    .flatMap((shape) =>
      shape.ty === 'gr' ? ((shape.it as typeof layer.shapes) ?? []) : [shape],
    )
    .find((shape) => shape.ty === 'rc');
  const position = rectangle?.p as LottieProperty | undefined;
  const size = rectangle?.s as LottieProperty | undefined;
  if (
    !position ||
    !size ||
    position.a === 1 ||
    size.a === 1 ||
    !Array.isArray(position.k) ||
    !Array.isArray(size.k)
  )
    malformed(`"${layer.nm}" has no static rectangle`);
  const [x, y] = position.k as number[];
  const [width, height] = size.k as number[];
  return { x, y, width, height };
};

/* The band's rectangle; it is read in stage units, so the layer and its group must not move it. */
const bandOf = (layer: LottieLayer) => {
  const groupTransform = (layer.shapes ?? [])
    .flatMap((shape) =>
      shape.ty === 'gr' ? ((shape.it as typeof layer.shapes) ?? []) : [],
    )
    .find((shape) => shape.ty === 'tr');
  const isPlaced = (property: unknown, identity: number) =>
    isIdentity(property as LottieProperty | undefined, identity);
  if (
    !isPlaced(layer.ks?.p, 0) ||
    !isPlaced(layer.ks?.a, 0) ||
    !isPlaced(layer.ks?.s, 100) ||
    !isPlaced(layer.ks?.r, 0) ||
    !isPlaced(groupTransform?.p, 0) ||
    !isPlaced(groupTransform?.a, 0) ||
    !isPlaced(groupTransform?.s, 100) ||
    !isPlaced(groupTransform?.r, 0)
  )
    malformed(`"${layer.nm}" is moved, scaled or rotated`);
  return rectangleOf(layer);
};

/* The authored references the stage solver lays the span out from, in stage units along +x. */
const readReferences = (
  root: readonly LottieLayer[],
  actorLayers: readonly LottieLayer[],
  needsCard: boolean,
): { references: CopyTrackSpanReferences; points: Map<string, Point> } => {
  const points = new Map<string, Point>();
  const reference = (name: string) => {
    if (!points.has(name))
      points.set(
        name,
        staticPoint(
          single(root, `${COPY_TRACK_ANCHOR_PREFIX}${name}`),
          'p',
          true,
        ),
      );
    return points.get(name) as Point;
  };
  const stance = reference(CopyTrackAnchor.Stance);
  const offset = (point: Point) => ({
    x: point.x - stance.x,
    y: point.y - stance.y,
  });
  const stretch = (anchor: CopyTrackAnchor) => ({
    min: offset(reference(`${anchor}${COPY_TRACK_MIN_SUFFIX}`)),
    max: offset(reference(anchor)),
  });
  const stretchable = {
    [CopyTrackAnchor.SpanStart]: stretch(CopyTrackAnchor.SpanStart),
    [CopyTrackAnchor.SpanEnd]: stretch(CopyTrackAnchor.SpanEnd),
    [CopyTrackAnchor.Far]: stretch(CopyTrackAnchor.Far),
  };
  if (!(
    stretchable[CopyTrackAnchor.SpanEnd].max.x >
      stretchable[CopyTrackAnchor.SpanStart].max.x &&
    stretchable[CopyTrackAnchor.SpanEnd].min.x >
      stretchable[CopyTrackAnchor.SpanStart].min.x &&
    stretchable[CopyTrackAnchor.SpanEnd].max.x >
      stretchable[CopyTrackAnchor.SpanEnd].min.x
  ))
    malformed('the span references are not authored toward +x');
  const band = bandOf(single(root, CopyTrackSlot.Band));
  const far = reference(CopyTrackAnchor.Far);
  const card = needsCard
    ? rectangleOf(single(actorLayers, COPY_TRACK_CARD_REFERENCE))
    : undefined;
  for (const name of Object.values(CopyTrackAnchor))
    if (
      !points.has(name) &&
      root.some(({ nm }) => nm === `${COPY_TRACK_ANCHOR_PREFIX}${name}`)
    )
      reference(name);
  return {
    points,
    references: {
      entry: stance.x - reference(CopyTrackAnchor.EntryEdge).x,
      stretchable,
      overhang: Math.max(0, band.x + band.width / 2 - far.x),
      cardWidth: card?.width ?? 0,
      cardHeight: card?.height ?? 0,
    },
  };
};

const isReferenceName = (name: string) =>
  name.startsWith(COPY_TRACK_ANCHOR_PREFIX);

/* Base names a `#<kinds>` layer may override: the stretchable references, the follow groups and the travel. */
const OVERRIDABLE = new Set<string>([
  ...COPY_TRACK_STRETCHABLE_ANCHORS.flatMap((anchor) => [
    `${COPY_TRACK_ANCHOR_PREFIX}${anchor}`,
    `${COPY_TRACK_ANCHOR_PREFIX}${anchor}${COPY_TRACK_MIN_SUFFIX}`,
  ]),
  ...Object.values(CopyTrackAnchor).map(
    (anchor) => `${COPY_TRACK_FOLLOW_PREFIX}${anchor}`,
  ),
  CopyTrackSlot.Travel,
]);

/* `<base>#<kind>[,<kind>…]`: the base layer name and the sections it overrides for. */
const splitOverride = (name: string) => {
  const at = name.indexOf(COPY_TRACK_SECTION_SEPARATOR);
  return { base: name.slice(0, at), kinds: name.slice(at + 1).split(',') };
};

/* Rejects a section override the asset cannot mean, before the page is measured. */
const checkOverrides = (
  root: readonly LottieLayer[],
  kinds: readonly CopyTrackSectionKind[],
) => {
  const seen = new Set<string>();
  for (const layer of root) {
    const name = layer.nm;
    if (!name?.includes(COPY_TRACK_SECTION_SEPARATOR)) continue;
    const { base, kinds: owners } = splitOverride(name);
    if (!OVERRIDABLE.has(base)) malformed(`"${name}" overrides no reference`);
    single(root, base);
    for (const owner of owners) {
      if (!kinds.includes(owner as CopyTrackSectionKind))
        malformed(`"${name}" names no declared section "${owner}"`);
      const key = `${base}${COPY_TRACK_SECTION_SEPARATOR}${owner}`;
      if (seen.has(key))
        malformed(`"${base}" is overridden twice for "${owner}"`);
      seen.add(key);
    }
    if (layer.ty !== 3 || layer.parent !== undefined)
      malformed(`"${name}" is not an unparented null`);
    if (base !== CopyTrackSlot.Travel) {
      staticPoint(layer, 'p', true);
      continue;
    }
    if (!isIdentity(layer.ks?.s, 100) || !isIdentity(layer.ks?.r, 0))
      malformed(`"${name}" is scaled or rotated`);
    const anchor = staticPoint(layer, 'a');
    if (anchor.x !== 0 || anchor.y !== 0)
      malformed(`"${name}" has an anchor point`);
  }
};

/* The root as one section sees it, with no override layer left. Its overrides
   give the travel and the follow groups their positions; with `withReferences`
   they also take the place of the base reference nulls. Follow groups bind
   against the base references, so they are read without them. */
const rootForSection = (
  root: readonly LottieLayer[],
  kind: CopyTrackSectionKind | undefined,
  withReferences = true,
): LottieLayer[] => {
  const own = new Map<string, LottieLayer>();
  for (const layer of root)
    if (layer.nm?.includes(COPY_TRACK_SECTION_SEPARATOR)) {
      const { base, kinds } = splitOverride(layer.nm);
      if (kind !== undefined && kinds.includes(kind)) own.set(base, layer);
    }
  return root
    .filter(({ nm }) => !nm?.includes(COPY_TRACK_SECTION_SEPARATOR))
    .map((layer) => {
      const override = layer.nm ? own.get(layer.nm) : undefined;
      if (!override || !layer.nm) return layer;
      if (!isReferenceName(layer.nm))
        return { ...layer, ks: { ...layer.ks, p: override.ks?.p } };
      return withReferences ? { ...override, nm: layer.nm } : layer;
    });
};

const hideLayer = (layer: LottieLayer): LottieLayer => ({
  ...layer,
  ks: { ...layer.ks, o: { a: 0, k: 0 } },
});

/* Shows `ct-if:copy` layers only with a copy and `ct-if:no-copy` layers only without one. */
const applyConditions = (layers: LottieLayer[], hasCopy: boolean) =>
  layers.map((layer) => {
    if (layer.nm?.startsWith(COPY_TRACK_IF_NO_COPY_PREFIX))
      return hasCopy ? hideLayer(layer) : layer;
    if (layer.nm?.startsWith(COPY_TRACK_IF_COPY_PREFIX))
      return hasCopy ? layer : hideLayer(layer);
    return layer;
  });

const isShownIn = (
  segments: readonly LottieTimeRemapSegment[],
  from: number,
  to: number,
) =>
  segments.find(
    (segment) =>
      from >= segment.localFrom - FRAME_EPSILON &&
      to <= segment.localTo + FRAME_EPSILON,
  );

/* The bind a travel keyframe at composition frame `frame` lies in, read through the section path. */
const travelBindAt = (
  path: readonly LottieTimeRemapSegment[],
  markers: CopyTrackMarkers,
  frame: number,
) => {
  const local = toLocalFrame(path, frame);
  const range =
    local === undefined ? undefined : findNamespacedRange(markers.binds, local);
  return (
    range ??
    malformed(`"ct-travel" has a keyframe outside every bind at frame ${frame}`)
  );
};

/* Tolerance, in stage units, within which a cycle's first and last poses count as one. */
const CYCLE_POSE_TOLERANCE = 0.25;

/* Whether a section shows a track: a track whose children all show only for the
   other copy condition stays hidden, so its keys never play there. */
const isTrackShown = (
  layers: readonly LottieLayer[],
  track: LottieLayer,
  hasCopy: boolean,
) => {
  const hidden = hasCopy
    ? COPY_TRACK_IF_NO_COPY_PREFIX
    : COPY_TRACK_IF_COPY_PREFIX;
  const children = layers.filter(
    (layer) => track.ind !== undefined && layer.parent === track.ind,
  );
  return (
    !children.length || !children.every(({ nm }) => nm?.startsWith(hidden))
  );
};

/* Every shown track a cycle moves has a keyframe at both of its edges, with the same position. */
const checkCycleClosure = (
  layers: readonly LottieLayer[],
  trackNames: readonly string[],
  cycle: { from: number; to: number },
  hasCopy: boolean,
) => {
  const at = (keyframes: readonly VectorKeyframe[], frame: number) =>
    keyframes.find(({ t }) => Math.abs(t - frame) <= FRAME_EPSILON);
  for (const name of trackNames) {
    const track = single(layers, name);
    if (!isTrackShown(layers, track, hasCopy)) continue;
    const keyframes = keyframesOf(track);
    if (
      !keyframes.some(
        ({ t }) =>
          t > cycle.from + FRAME_EPSILON && t < cycle.to - FRAME_EPSILON,
      )
    )
      continue;
    const first = at(keyframes, cycle.from);
    const last = at(keyframes, cycle.to);
    if (!first || !last)
      malformed(`"${name}" has no keyframe at an edge of cycle ${cycle.from}`);
    if (
      Math.hypot(first.s[0] - last.s[0], first.s[1] - last.s[1]) >
      CYCLE_POSE_TOLERANCE
    )
      malformed(`"${name}" does not close cycle ${cycle.from}`);
  }
};

interface SectionCheckInputs {
  authored: Composition;
  actorLayers: readonly LottieLayer[];
  trackNames: readonly string[];
  facingLayer?: string;
  markers: CopyTrackMarkers;
  points: Map<string, Point>;
}

/* What one section needs from the asset, checked at its references: every bind
   names a reference, every track and travel keyframe is bound, the cycles have
   authored travel, and a copy section's copy has its entry key, its hide window
   and a key at every step of the section path. */
const checkSection = (
  section: CopyTrackMarkers['sections'][number],
  {
    authored,
    actorLayers,
    trackNames,
    facingLayer,
    markers,
    points,
  }: SectionCheckInputs,
) => {
  const root = rootForSection(authored.layers, section.kind);
  const path = buildSplicedPath(
    markers.trunk,
    markers.splices[section.kind] ?? [],
  );
  const travel = keyframesOf(single(root, CopyTrackSlot.Travel));
  travel.forEach(({ t }) => travelBindAt(path, markers, t));
  const anchors: Record<string, LottieAnchorTarget> = {};
  for (const { argument } of markers.binds)
    if (argument)
      anchors[argument] = {
        point:
          points.get(argument) ?? malformed(`no reference for "${argument}"`),
        side: 1,
      };
  bindTrackLayers(
    [
      ...root.filter(({ nm }) => nm?.startsWith(COPY_TRACK_ANCHOR_PREFIX)),
      ...actorLayers,
    ],
    {
      trackLayers: trackNames,
      facingLayer,
      referencePrefix: COPY_TRACK_ANCHOR_PREFIX,
      bindings: markers.binds,
      stretches: markers.stretches,
      anchors,
      holdsRest: true,
    },
  );
  let segments = path;
  for (const { cycle, window } of markers.cycles) {
    if (!isShownIn(segments, window.from, window.to)) continue;
    const from = toCompositionFrame(segments, window.from) as number;
    const to = toCompositionFrame(segments, window.to) as number;
    if (!(Math.abs(travelAt(travel, to).x - travelAt(travel, from).x) > 0))
      malformed(`cycle window ${window.from} has no authored travel`);
    checkCycleClosure(
      actorLayers,
      trackNames,
      cycle,
      section.role !== undefined,
    );
    /* Two plays make every step the measured path can have. */
    segments = repeatCycle(segments, { cycle, from, to, count: 2 });
  }
  if (section.role === undefined) return;
  if (markers.entryFrame === undefined || markers.restoreFrame === undefined)
    malformed('no entry or restore marker');
  const onPath = (frame: number) => {
    const splice = (markers.splices[section.kind] ?? []).find(
      ({ cut }) =>
        frame >= cut.from - FRAME_EPSILON && frame <= cut.to + FRAME_EPSILON,
    );
    return splice ? splice.fill.from + (frame - splice.cut.from) : frame;
  };
  const end = segments[segments.length - 1].to;
  const shareOf = (local: number) =>
    (toCompositionFrame(segments, local) ??
      malformed(`frame ${local} never plays`)) / end;
  const hideAt = shareOf(onPath(markers.entryFrame));
  if (!(
    hideAt >= SNAPSHOT_HIDE_FADE_SHARE &&
    hideAt <= shareOf(onPath(markers.restoreFrame))
  ))
    malformed('"ct:entry" lies outside the hide window');
  if (section.role !== CopyTrackRole.StarterCard) return;
  const copyLayer = single(actorLayers, CopyTrackSlot.Copy);
  if (
    !keyframesOf(copyLayer).some(
      ({ t }) =>
        Math.abs(t - onPath(markers.entryFrame as number)) <= FRAME_EPSILON,
    )
  )
    malformed('"ct-track:copy" has no keyframe at the entry');
  copyPathKeyframes(copyLayer, {
    durationMs: (end / authored.fr) * 1000,
    frameRate: authored.fr,
    segments,
    origin: { x: 0, y: 0 },
    scale: 1,
  });
};

/**
 * Returns the copy-track preparation: a private copy of `data` mapped onto the
 * composer, with the first qualifying section spliced into the actor's time
 * remap, every track bound, stretched or followed onto the measured stage,
 * step cycles repeated over the measured travel, conditional layers set, and
 * the section's copy prepared. Throws when the poster must show.
 */
export const prepareCopyTrackScene = (
  data: unknown,
  placement: CelebrationComposerAnchorPlacement,
  { anchors, isMobile, direction }: CopyTrackEnvironment,
): PackScenePreparation => {
  if (typeof data !== 'object' || data === null) malformed('no composition');
  const authored = JSON.parse(JSON.stringify(data)) as Composition;
  if (!(authored.fr > 0)) malformed('no frame rate');
  if ((authored.ip ?? 0) !== 0)
    malformed('the composition does not start at 0');

  /* Every rule that depends on the asset alone is checked before the page is measured. */
  const actorLayer = single(authored.layers, CopyTrackSlot.Actor);
  const travelLayer = single(authored.layers, CopyTrackSlot.Travel);
  if (actorLayer.ty !== 0) malformed('"ct-actor" is not a precomposition');
  if (actorLayer.tm !== undefined)
    malformed('"ct-actor" has its own time remap');
  if ((actorLayer.st ?? 0) !== 0) malformed('"ct-actor" does not start at 0');
  if (travelLayer.ty !== 3 || travelLayer.parent !== undefined)
    malformed('"ct-travel" is not an unparented null');
  if (travelLayer.ind === undefined || actorLayer.parent !== travelLayer.ind)
    malformed('"ct-actor" is not carried by "ct-travel"');
  for (const layer of [actorLayer, travelLayer])
    if (!isIdentity(layer.ks?.s, 100) || !isIdentity(layer.ks?.r, 0))
      malformed(`"${layer.nm}" is scaled or rotated`);
  const travelAnchor = staticPoint(travelLayer, 'a');
  if (travelAnchor.x !== 0 || travelAnchor.y !== 0)
    malformed('"ct-travel" has an anchor point');
  const asset = authored.assets?.find(({ id }) => id === actorLayer.refId);
  if (!asset?.layers?.length) malformed('"ct-actor" has no layers');
  const actorEnd = Math.max(...asset.layers.map(({ op }) => op ?? 0));
  const markers: CopyTrackMarkers = readCopyTrackMarkers(authored, {
    from: 0,
    to: actorEnd,
  });
  if (markers.trunk.to - markers.trunk.from > authored.op + FRAME_EPSILON)
    malformed('the trunk is longer than the composition');
  const needsCard = markers.sections.some(
    ({ role }) => role === CopyTrackRole.StarterCard,
  );
  checkOverrides(
    authored.layers,
    markers.sections.map(({ kind }) => kind),
  );
  const actorAssetLayers = asset.layers;
  const baseRoot = rootForSection(authored.layers, undefined);
  const { references } = readReferences(baseRoot, actorAssetLayers, needsCard);
  /* `ct-band` is authored against the base references, so its overhang past `far` is the base one. */
  const sectionReferences = new Map(
    markers.sections.map(({ kind }) => {
      const own = readReferences(
        rootForSection(authored.layers, kind),
        actorAssetLayers,
        needsCard,
      );
      return [
        kind,
        {
          ...own,
          references: { ...own.references, overhang: references.overhang },
        },
      ];
    }),
  );
  const actorShift = {
    x: staticPoint(actorLayer, 'p').x - staticPoint(actorLayer, 'a').x,
    y: staticPoint(actorLayer, 'p').y - staticPoint(actorLayer, 'a').y,
  };
  const trackNames = asset.layers
    .filter(({ nm }) => nm?.startsWith(COPY_TRACK_TRACK_PREFIX))
    .map(({ nm }) => nm as string);
  single(asset.layers, CopyTrackSlot.Root);
  const facingLayer = asset.layers.some(({ nm }) => nm === CopyTrackSlot.Facing)
    ? CopyTrackSlot.Facing
    : undefined;
  for (const section of markers.sections)
    checkSection(section, {
      authored,
      actorLayers: actorAssetLayers,
      trackNames,
      facingLayer,
      markers,
      points: (
        sectionReferences.get(section.kind) as { points: Map<string, Point> }
      ).points,
    });

  /* Measure the host once, after the asset is known to be sound. */
  const mapping =
    resolveComposerAnchor(placement, anchors.composer, false) ??
    malformed('no composer and no stage anchor');
  const s = mapping.scale;
  const composer = mapping.source ?? undefined;
  const needsWord = markers.sections.some(
    ({ role }) => role === CopyTrackRole.ComposerWord,
  );
  const word = needsWord && composer ? findTextRun(composer) : null;
  const host = measureCopyTrackHost(anchors, {
    composer,
    isMobile,
    direction,
    referenceCard: {
      width: references.cardWidth * s,
      height: references.cardHeight * s,
    },
    word: word?.rect,
  });
  const chosen =
    chooseCopyTrackSection(
      markers.sections,
      host,
      ({ kind }) =>
        (sectionReferences.get(kind) ?? malformed(`no section "${kind}"`))
          .references,
      s,
    ) ?? malformed('no section fits this page');
  const { section, plan } = chosen;
  const sectionRoot = rootForSection(authored.layers, section.kind);
  const { points } = sectionReferences.get(section.kind) as ReturnType<
    typeof readReferences
  >;
  /* The story always travels toward +x on the stage; travel toward −x mirrors the whole stage. */
  const mirror = plan.side;
  const stageMapping: ComposerAnchorMapping = {
    ...mapping,
    isMirrored: mirror < 0,
  };
  const toStage = ({ x, y }: Point): Point => ({
    x: mapping.pivot.x + (mirror * (x - mapping.origin.x)) / s,
    y: mapping.pivot.y + (y - mapping.origin.y) / s,
  });
  const measured: Record<string, LottieAnchorTarget> = {};
  for (const [name, point] of Object.entries(plan.anchors))
    if (point) measured[name] = { point: toStage(point), side: 1 };

  /* Root: the follow groups move rigidly with their anchors, authored against the base references. */
  const rootBound = bindTrackLayers(
    rootForSection(authored.layers, section.kind, false),
    {
      trackLayers: [],
      referencePrefix: COPY_TRACK_ANCHOR_PREFIX,
      followPrefix: COPY_TRACK_FOLLOW_PREFIX,
      bindings: markers.binds,
      anchors: measured,
    },
  );
  /* The travel is a relative carrier: it moves only where it is authored to move,
     by its authored step plus the change in anchor displacement across that step,
     read from the bind the section path shows at that composition frame. */
  const sectionPath = buildSplicedPath(
    markers.trunk,
    markers.splices[section.kind] ?? [],
  );
  const authoredTravel = keyframesOf(single(sectionRoot, CopyTrackSlot.Travel));
  const displacementAt = (frame: number): Point => {
    const range = travelBindAt(sectionPath, markers, frame);
    const target = range.argument ? measured[range.argument] : undefined;
    if (!range.argument || !target)
      malformed(
        `"ct-travel" is bound to an unmeasured anchor at frame ${frame}`,
      );
    const reference =
      points.get(range.argument) ??
      malformed(`no reference for "${range.argument}"`);
    return {
      x: target.point.x - reference.x,
      y: target.point.y - reference.y,
    };
  };
  const boundTravel: VectorKeyframe[] = [];
  authoredTravel.forEach((keyframe, index) => {
    const previous = authoredTravel[index - 1];
    if (!previous) {
      boundTravel.push({ ...keyframe, s: [...keyframe.s] });
      return;
    }
    const isMoving =
      Math.abs(keyframe.s[0] - previous.s[0]) > FRAME_EPSILON ||
      Math.abs(keyframe.s[1] - previous.s[1]) > FRAME_EPSILON;
    const from = displacementAt(previous.t);
    const to = displacementAt(keyframe.t);
    const last = boundTravel[index - 1].s;
    boundTravel.push({
      ...keyframe,
      s: [
        last[0] +
          (keyframe.s[0] - previous.s[0]) +
          (isMoving ? to.x - from.x : 0),
        last[1] +
          (keyframe.s[1] - previous.s[1]) +
          (isMoving ? to.y - from.y : 0),
        ...keyframe.s.slice(2),
      ],
    });
  });
  const travelIndex = rootBound.findIndex(
    ({ nm }) => nm === CopyTrackSlot.Travel,
  );
  if (boundTravel.length)
    rootBound[travelIndex] = {
      ...rootBound[travelIndex],
      ks: { ...rootBound[travelIndex].ks, p: { a: 1, k: boundTravel } },
    };

  /* The section path, then the cycles over the measured travel. */
  let segments = sectionPath;
  const cycleWindows: { from: number; to: number; compositionFrom: number }[] =
    [];
  const strideScales: { from: number; to: number; scale: number }[] = [];
  for (const { cycle, window } of markers.cycles) {
    const piece = isShownIn(segments, window.from, window.to);
    if (!piece) continue;
    const from = toCompositionFrame(segments, window.from) as number;
    const to = toCompositionFrame(segments, window.to) as number;
    const authoredDistance = Math.abs(
      travelAt(authoredTravel, to).x - travelAt(authoredTravel, from).x,
    );
    const authoredCount = Math.round(
      (window.to - window.from) / (cycle.to - cycle.from),
    );
    const distance = Math.abs(
      travelAt(boundTravel, to).x - travelAt(boundTravel, from).x,
    );
    const stride = authoredDistance / authoredCount;
    const count = cycleCount(distance, stride);
    segments = repeatCycle(segments, { cycle, from, to, count });
    strideScales.push({
      from: cycle.from,
      to: cycle.to,
      scale: distance / (count * stride),
    });
    cycleWindows.push({
      from: cycle.from,
      to: cycle.to,
      compositionFrom: from,
    });
  }

  /* Actor tracks: bound in stage coordinates, then carried back into actor space at their composition time. */
  /* Keys the chosen section never shows still shape the segments next to the
     ones it does, so they are carried with the time they were authored for:
     a trunk key at its own frame, a fill key at its cut's frame, and a key in
     a step cycle at its window's start. */
  const authoredFrame = (local: number): number => {
    for (const splices of Object.values(markers.splices))
      for (const { cut, fill } of splices ?? [])
        if (
          local >= fill.from - FRAME_EPSILON &&
          local <= fill.to + FRAME_EPSILON
        )
          return cut.from + (local - fill.from);
    return local;
  };
  const ownFrame = (local: number) => {
    const cycle = markers.cycles.find(
      ({ cycle: range }) =>
        local >= range.from - FRAME_EPSILON &&
        local <= range.to + FRAME_EPSILON,
    );
    return authoredFrame(cycle ? cycle.window.from : local);
  };
  const compositionFrameOf = (local: number) => {
    const inCycle = cycleWindows.find(
      ({ from, to }) =>
        local >= from - FRAME_EPSILON && local <= to + FRAME_EPSILON,
    );
    if (inCycle) return inCycle.compositionFrom;
    return toCompositionFrame(segments, local) ?? ownFrame(local);
  };
  const shiftAt = (track: readonly VectorKeyframe[], frame: number) => {
    const travel = travelAt(track, frame);
    return { x: actorShift.x + travel.x, y: actorShift.y + travel.y };
  };
  const toStageKeys = (
    layer: LottieLayer,
    sign: 1 | -1,
    track: VectorKeyframe[],
  ) => {
    const keyframes = keyframesOf(layer);
    if (!keyframes.length) return layer;
    return {
      ...layer,
      ks: {
        ...layer.ks,
        p: {
          a: 1,
          k: keyframes.map((keyframe) => {
            const shift = shiftAt(track, compositionFrameOf(keyframe.t));
            const [x, y, ...rest] = keyframe.s;
            return {
              ...keyframe,
              s: [x + sign * shift.x, y + sign * shift.y, ...rest],
            };
          }),
        },
      },
    };
  };
  /* A whole number of cycles covers the measured travel, so each cycle's stride
     is scaled to the travel per cycle: x offsets from the cycle's first key,
     which keeps a closed cycle closed. A track with no key there is left as is. */
  const scaleStrides = (layer: LottieLayer): LottieLayer => {
    const keyframes = keyframesOf(layer);
    if (!keyframes.length || !strideScales.length) return layer;
    const isIn = (frame: number, from: number, to: number) =>
      frame >= from - FRAME_EPSILON && frame <= to + FRAME_EPSILON;
    return {
      ...layer,
      ks: {
        ...layer.ks,
        p: {
          a: 1,
          k: keyframes.map((keyframe) => {
            const range = strideScales.find(({ from, to }) =>
              isIn(keyframe.t, from, to),
            );
            const origin =
              range &&
              keyframes.find(({ t }) => isIn(t, range.from, range.from));
            if (!range || !origin) return keyframe;
            const [x, ...rest] = keyframe.s;
            return {
              ...keyframe,
              s: [origin.s[0] + range.scale * (x - origin.s[0]), ...rest],
            };
          }),
        },
      },
    };
  };
  const referenceLayers = sectionRoot.filter(({ nm }) =>
    nm?.startsWith(COPY_TRACK_ANCHOR_PREFIX),
  );
  const inStage = asset.layers.map((layer) =>
    trackNames.includes(layer.nm ?? '')
      ? toStageKeys(scaleStrides(layer), 1, authoredTravel)
      : layer,
  );
  const boundActor = bindTrackLayers([...referenceLayers, ...inStage], {
    trackLayers: trackNames,
    facingLayer,
    referencePrefix: COPY_TRACK_ANCHOR_PREFIX,
    bindings: markers.binds,
    stretches: markers.stretches,
    anchors: measured,
    holdsRest: true,
  }).slice(referenceLayers.length);
  const hasCopy = section.role !== undefined;
  asset.layers = applyConditions(
    boundActor.map((layer) =>
      trackNames.includes(layer.nm ?? '')
        ? toStageKeys(layer, -1, boundTravel)
        : layer,
    ),
    hasCopy,
  );
  authored.layers = applyConditions(
    rootBound.map((layer) =>
      layer.nm === CopyTrackSlot.Actor ? actorLayer : layer,
    ),
    hasCopy,
  );
  actorLayer.tm = toTimeRemapProperty(segments, authored.fr);
  const end = segments[segments.length - 1].to;
  if (end < authored.op) {
    authored.op = end;
    authored.layers.forEach((layer) => {
      layer.op = Math.min(layer.op ?? end, end);
    });
  }
  const copy = rebaseStageOntoViewport(authored, stageMapping) as Composition;
  const preparation: PackScenePreparation = {
    data: copy,
    aspectRatio: (data as Composition).w / (data as Composition).h,
    anchor: stageMapping,
  };
  const watched = [
    ...host.watched.map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
    })),
  ];
  if (!hasCopy) {
    preparation.companion = {
      kind: PackSceneCompanionKind.CopyTrack,
      watched,
      restoreMs: 0,
      handlers: {},
    };
    return preparation;
  }

  /* The copy: its authored track over the section path, carried by the travel. */
  if (markers.entryFrame === undefined || markers.restoreFrame === undefined)
    malformed('no entry or restore marker');
  /* A marker inside a cut the section replaces maps onto the same offset in its fill. */
  const onPath = (frame: number) => {
    const splice = (markers.splices[section.kind] ?? []).find(
      ({ cut }) =>
        frame >= cut.from - FRAME_EPSILON && frame <= cut.to + FRAME_EPSILON,
    );
    return splice ? splice.fill.from + (frame - splice.cut.from) : frame;
  };
  const entryFrame = onPath(markers.entryFrame);
  const restoreFrame = onPath(markers.restoreFrame);
  const durationMs = (end / copy.fr) * 1000;
  const toMs = (local: number) =>
    ((toCompositionFrame(segments, local) ??
      malformed(`frame ${local} never plays`)) /
      copy.fr) *
    1000;
  const restoreMs = toMs(restoreFrame);
  const restoreAt = restoreMs / durationMs;
  const hideAt = toMs(entryFrame) / durationMs;
  if (!(hideAt >= SNAPSHOT_HIDE_FADE_SHARE && hideAt <= restoreAt))
    malformed('"ct:entry" lies outside the hide window');
  const copyLayer = single(asset.layers, CopyTrackSlot.Copy);
  const copyKeys = keyframesOf(copyLayer);
  const atEntry =
    copyKeys.find(({ t }) => Math.abs(t - entryFrame) <= FRAME_EPSILON) ??
    malformed('"ct-track:copy" has no keyframe at the entry');
  const entryComposition = toCompositionFrame(segments, entryFrame) as number;
  const frames = copyPathKeyframes(copyLayer, {
    durationMs,
    frameRate: copy.fr,
    segments,
    origin: { x: atEntry.s[0], y: atEntry.s[1] },
    scale: s,
    mirror,
  });
  const travelStart = travelAt(boundTravel, entryComposition);
  const travelFrames = boundTravel.length
    ? copyTravelKeyframes(single(rootBound, CopyTrackSlot.Travel), {
        durationMs,
        frameRate: copy.fr,
        origin: travelStart,
        scale: s,
        mirror,
      })
    : undefined;
  const handlers: CopyTrackPreparation['handlers'] = {};
  const onStop = () => handlers.onCopyStopped?.();
  if (section.role === CopyTrackRole.StarterCard) {
    const card = plan.card ?? malformed('a card section without a card');
    preparation.companion = {
      kind: PackSceneCompanionKind.CopyTrack,
      copy: prepareCelebrationSnapshots([card], {
        durationMs,
        hideAt,
        restoreAt,
        restoreShare: COPY_RESTORE_SHARE,
        frames: () => frames,
        travelFrames: travelFrames && (() => travelFrames),
        onStop,
      }),
      watched: [...watched, card],
      restoreMs,
      handlers,
    };
    return preparation;
  }
  const run = word ?? malformed('a word section without a word');
  const session = prepareTextRunCopy(run, {
    durationMs,
    showAt: hideAt,
    hideAt: restoreAt,
    frames,
    travelFrames,
  });
  /* A text-run copy has no listeners of its own; any interaction stops it, as a snapshot does. */
  let attachedHost: HTMLElement | undefined;
  let isStopped = false;
  const stopWord = () => {
    if (isStopped) return;
    isStopped = true;
    COPY_INTERACTION_EVENTS.forEach((name) =>
      document.removeEventListener(name, onInteraction, true),
    );
    window.removeEventListener('resize', stopWord);
    session.stop();
    onStop();
  };
  const onInteraction = (event: Event) => {
    if (
      event.type === 'scroll' &&
      event.target instanceof Node &&
      attachedHost?.contains(event.target)
    )
      return;
    stopWord();
  };
  preparation.companion = {
    kind: PackSceneCompanionKind.CopyTrack,
    copy: {
      attach: (layer) => {
        attachedHost = layer;
        session.attach(layer);
      },
      start: (startTime) => {
        if (isStopped) return;
        COPY_INTERACTION_EVENTS.forEach((name) =>
          document.addEventListener(name, onInteraction, true),
        );
        window.addEventListener('resize', stopWord);
        session.start(startTime);
      },
      stop: stopWord,
    },
    watched: [
      ...watched,
      { element: run.element, rect: run.element.getBoundingClientRect() },
    ],
    restoreMs,
    handlers,
  };
  return preparation;
};

/** Attaches the copy beneath the renderer and watches the measured host. */
export const onCopyTrackAnimationCreated = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<PackScenePreparation>): void => {
  const { companion: copyTrack } = preparation;
  if (copyTrack?.kind !== PackSceneCompanionKind.CopyTrack) return;
  const { copy } = copyTrack;
  if (copy) {
    const layer = document.createElement('div');
    layer.setAttribute(COPY_LAYER_ATTRIBUTE, '');
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    });
    /* Registered first, so a throwing attach still removes what it appended. */
    addDisposer(() => {
      copy.stop();
      layer.remove();
    });
    host.prepend(layer);
    copy.attach(layer);
    /* A stop before the restore means the copy saw an interruption. */
    copyTrack.handlers.onCopyStopped = () => {
      const { startedAtMs } = copyTrack.handlers;
      if (startedAtMs === undefined) return;
      const now = document.timeline?.currentTime;
      const elapsed =
        (typeof now === 'number' ? now : performance.now()) - startedAtMs;
      if (elapsed < copyTrack.restoreMs) cancel();
    };
  }
  /* Any live interaction ends every section, with or without a copy; a scroll inside the scene is its own. */
  const onInteraction = (event: Event) => {
    if (
      event.type === 'scroll' &&
      event.target instanceof Node &&
      host.contains(event.target)
    )
      return;
    cancel();
  };
  COPY_INTERACTION_EVENTS.forEach((name) =>
    document.addEventListener(name, onInteraction, true),
  );
  window.addEventListener('resize', cancel);
  addDisposer(() => {
    COPY_INTERACTION_EVENTS.forEach((name) =>
      document.removeEventListener(name, onInteraction, true),
    );
    window.removeEventListener('resize', cancel);
  });
  /* Compared against the rectangles they were measured at. */
  addDisposer(observeSceneTargets(copyTrack.watched, cancel, [host]));
};

/** Starts the copy on the Lottie clock. */
export const onCopyTrackPlaybackStarted = ({
  preparation,
  timelineZeroMs,
}: LottiePlaybackStartContext<PackScenePreparation>): void => {
  const { companion: copyTrack } = preparation;
  if (copyTrack?.kind !== PackSceneCompanionKind.CopyTrack || !copyTrack.copy)
    return;
  copyTrack.handlers.startedAtMs = timelineZeroMs;
  copyTrack.copy.start(timelineZeroMs);
};
