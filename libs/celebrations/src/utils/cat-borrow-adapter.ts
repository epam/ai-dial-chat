import {
  CAT_BORROW_ANCHOR_PREFIX,
  CAT_BORROW_MARKERS,
  CAT_BORROW_REFERENCE_SIZE,
} from '../constants/cat-borrow';
import type {
  CatBorrowPrize,
  CatBorrowPreparation,
} from '../models/cat-borrow';
import type { CelebrationAnchors } from '../models/celebration';
import type { CelebrationComposerAnchorPlacement } from '../models/celebration-pack';
import type { LottieAnchorTarget } from '../models/lottie-anchor-binding';
import type {
  LottieComposition,
  LottieLayer,
  LottieProperty,
  Point,
} from '../models/lottie-composition';
import type {
  LottieMarkerScope,
  LottieNamespacedMarker,
} from '../models/lottie-markers';
import type {
  LottieAnimationContext,
  LottiePlaybackStartContext,
} from '../models/lottie-scene';
import type {
  LottieLocalRange,
  LottieTimeRemapSegment,
} from '../models/lottie-time-remap';
import {
  CatBorrowAnchor,
  CatBorrowMarker,
  CatBorrowSection,
  CatBorrowSlot,
} from '../types/cat-borrow';
import { PackSceneCompanionKind } from '../types/pack-scene';
import { findBorrowTargets, type BorrowTargets } from './borrow-targets';
import type { PackScenePreparation } from './celebration-pack-scene';
import {
  prepareCelebrationSnapshots,
  SNAPSHOT_HIDE_FADE_SHARE,
} from './celebration-snapshots';
import {
  COMPOSER_ANCHOR_LAYER_NAME,
  rebaseStageOntoViewport,
  resolveComposerAnchor,
  type ComposerAnchorMapping,
} from './composer-anchor';
import { bindStationKeyframes, facingSignAt } from './lottie-anchor-binding';
import { readNamespacedMarkers } from './lottie-markers';
import {
  applyElasticRange,
  buildSectionPath,
  toCompositionFrame,
  toTimeRemapProperty,
} from './lottie-time-remap';
import {
  appendCopyFall,
  COPY_RESTORE_SHARE,
  copyFallMs,
  copyTrackKeyframes,
} from './lottie-track-keyframes';
import { observeSceneTargets } from './scene-targets';

/* Compiled Cat rules the adapter keeps, in viewport pixels or cat sizes. */
const MIN_DROP_PX = 24;
const EDGE_GAP_PX = 3;
const CAT_MARGIN_SIZES = 0.46;
const SUPPORT_CLEARANCE_PX = 12;
const REBOUND_DROP_SHARE = 0.32;
const REBOUND_MAX_SIZES = 0.75;
const CROSSING_LIFT_PX = 24;
const COPY_LAYER_ATTRIBUTE = 'data-cat-borrow-copies';

interface Composition extends LottieComposition {
  fr: number;
  assets?: { id: string; layers?: LottieLayer[] }[];
  markers?: unknown[];
}

interface Rig {
  layer: LottieLayer;
  asset: { id: string; layers: LottieLayer[] };
  /** Rig coordinates are stage coordinates plus this shift. */
  shift: Point;
  /** Last local frame any rig layer reaches. */
  end: number;
}

interface StoryPath {
  ranges: LottieLocalRange[];
  markers: LottieNamespacedMarker[];
}

/* One story the asset can play, validated before anything is measured. */
interface Story {
  count: number;
  path: StoryPath;
  /** Authored stand offset and side of each prize, read from this path. */
  stands: { offset: number; side: 1 | -1 }[];
  /** Authored push of each prize, in stage units, read from this path. */
  pushes: number[];
  /** The last prize's landing, whose duration is its elastic range. */
  landing?: LottieNamespacedMarker;
}

interface Floor {
  layer: LottieLayer;
  rectangle: Record<string, unknown>;
  gradient: Record<string, unknown>;
}

/* Stories from the most prizes down; the first the page can play wins. */
const STORY_COUNTS = [2, 1, 0];

const malformed: (reason: string) => never = (reason) => {
  throw new Error(`Malformed cat-borrow scene: ${reason}`);
};

const staticPoint = (layer: LottieLayer, key: 'a' | 'p'): Point => {
  const property = layer.ks?.[key];
  if (!property || property.a === 1 || !Array.isArray(property.k))
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

/* `data` is the rebased copy, whose unparented root layers hang from the anchor null. */
const findRig = (data: Composition): Rig => {
  if ((data.ip ?? 0) !== 0) malformed('the composition does not start at 0');
  const layers = data.layers.filter(({ nm }) => nm === CatBorrowSlot.Rig);
  if (layers.length !== 1 || layers[0].ty !== 0)
    malformed('expected one "cat-rig" precomposition');
  const [layer] = layers;
  if (layer.tm !== undefined) malformed('"cat-rig" has its own time remap');
  if ((layer.st ?? 0) !== 0) malformed('"cat-rig" does not start at frame 0');
  const anchorNull = data.layers.find(
    ({ nm }) => nm === COMPOSER_ANCHOR_LAYER_NAME,
  );
  if (anchorNull === undefined || layer.parent !== anchorNull.ind)
    malformed('"cat-rig" has a parent');
  /* Stage-to-rig is a pure shift only for an unscaled, unrotated rig. */
  if (!isIdentity(layer.ks?.s, 100) || !isIdentity(layer.ks?.r, 0))
    malformed('"cat-rig" is scaled or rotated');
  const asset = data.assets?.find(({ id }) => id === layer.refId);
  if (!asset?.layers?.length) malformed('"cat-rig" has no layers');
  const anchor = staticPoint(layer, 'a');
  const position = staticPoint(layer, 'p');
  return {
    layer,
    asset: asset as Rig['asset'],
    shift: { x: anchor.x - position.x, y: anchor.y - position.y },
    end: Math.max(...(asset.layers ?? []).map(({ op }) => op ?? 0)),
  };
};

const rigLayer = (rig: Rig, name: string) => {
  const matches = rig.asset.layers.filter(({ nm }) => nm === name);
  if (matches.length !== 1)
    malformed(`expected one "${name}" layer, found ${matches.length}`);
  return matches[0];
};

const firstKeyframes = (layer: LottieLayer, key: 'p' | 's') => {
  const property = layer.ks?.[key];
  if (property?.a !== 1) malformed(`"${layer.nm}" ${key} is not keyframed`);
  return property.k as { t: number; s: number[] }[];
};

const find = (
  markers: readonly LottieNamespacedMarker[],
  kind: CatBorrowMarker,
  argument?: string,
) =>
  markers.find(
    (marker) => marker.kind === kind && marker.argument === argument,
  );

const requireMarker = (
  markers: readonly LottieNamespacedMarker[],
  kind: CatBorrowMarker,
  argument?: string,
) =>
  find(markers, kind, argument) ??
  malformed(`no "cat:${kind}${argument === undefined ? '' : `:${argument}`}"`);

/* The authored stand offset from `prize-N` and the authored side, read from the
   first station keyframe of that anchor's bind range. */
const authoredStand = (
  rig: Rig,
  markers: readonly LottieNamespacedMarker[],
  index: number,
) => {
  const name = `prize-${index}`;
  const range = requireMarker(markers, CatBorrowMarker.Bind, name);
  const keyframe =
    firstKeyframes(rigLayer(rig, CatBorrowSlot.Root), 'p').find(
      ({ t }) => t >= range.frame && t < range.frame + range.duration,
    ) ?? malformed(`no station in "${name}"`);
  const reference = staticPoint(
    rigLayer(rig, `${CAT_BORROW_ANCHOR_PREFIX}${name}`),
    'p',
  );
  const side = facingSignAt(
    firstKeyframes(rigLayer(rig, CatBorrowSlot.Facing), 's'),
    range.frame,
  );
  return { offset: (keyframe.s[0] - reference.x) * side, side };
};

/* The push from the track's rest at the story's first frame to the release. */
const authoredPush = (
  rig: Rig,
  index: number,
  fromFrame: number,
  releaseFrame: number,
) => {
  const keyframes = firstKeyframes(rigLayer(rig, `prize-${index}`), 'p');
  const rest =
    keyframes.find(({ t }) => t >= fromFrame) ??
    malformed(`"prize-${index}" has no keyframe in the story`);
  const atRelease =
    keyframes.find(({ t }) => t === releaseFrame) ??
    malformed(`"prize-${index}" has no keyframe at the release`);
  return Math.abs(atRelease.s[0] - rest.s[0]);
};

/* The compiled Cat's reachability, with the authored stand and push. */
const measurePrizes = (
  targets: BorrowTargets,
  stands: { offset: number }[],
  pushes: number[],
  scale: number,
): CatBorrowPrize[] => {
  const { width, height, composer } = targets;
  if (!composer) return [];
  const margin = CAT_BORROW_REFERENCE_SIZE * CAT_MARGIN_SIZES * scale;
  const prizes: CatBorrowPrize[] = [];
  for (const target of targets.buttons) {
    const index = prizes.length;
    if (index >= stands.length) break;
    const { rect } = target;
    if (height - rect.bottom < MIN_DROP_PX) continue;
    const pushPx = pushes[index] * scale;
    const preferred: 1 | -1 =
      rect.left + rect.width / 2 >= composer.rect.left + composer.rect.width / 2
        ? 1
        : -1;
    for (const side of [preferred, -preferred as 1 | -1]) {
      const edge = side > 0 ? rect.left : rect.right;
      const standX = edge + side * stands[index].offset * scale;
      const travel =
        side > 0 ? width - rect.right - EDGE_GAP_PX : rect.left - EDGE_GAP_PX;
      const finalX = standX + side * pushPx;
      if (
        travel < pushPx ||
        [standX, finalX].some((x) => x < margin || x > width - margin)
      )
        continue;
      const left = rect.left + side * pushPx;
      const support = targets.supports
        .filter(
          ({ element, rect: candidate }) =>
            element !== target.element &&
            candidate.top >= rect.bottom + SUPPORT_CLEARANCE_PX &&
            Math.min(left + rect.width, candidate.right) -
              Math.max(left, candidate.left) >=
              Math.min(16, rect.width * 0.3),
        )
        .sort((a, b) => a.rect.top - b.rect.top)[0];
      const dropPx = (support?.rect.top ?? height - 2) - rect.bottom;
      if (dropPx < MIN_DROP_PX) continue;
      prizes.push({ target, side, standX, pushPx, support, dropPx });
      break;
    }
  }
  return prizes;
};

const pathFor = (
  scopes: readonly LottieMarkerScope[],
  count: number,
): StoryPath | undefined => {
  const scope = (section: CatBorrowSection) =>
    scopes.find(({ marker }) => marker?.argument === section);
  const whole = (section: LottieMarkerScope): StoryPath => ({
    ranges: [
      {
        from: section.marker?.frame ?? 0,
        to: (section.marker?.frame ?? 0) + (section.marker?.duration ?? 0),
      },
    ],
    markers: section.markers,
  });
  const two = scope(CatBorrowSection.TwoPrizes);
  const one = scope(CatBorrowSection.OnePrize);
  if (count >= 2 && two) return whole(two);
  if (count === 1 && one) {
    const branch =
      two &&
      find(two.markers, CatBorrowMarker.Branch, CatBorrowSection.OnePrize);
    if (!two || !branch) return whole(one);
    return {
      ranges: [
        { from: two.marker?.frame ?? 0, to: branch.frame },
        ...whole(one).ranges,
      ],
      markers: [
        ...two.markers.filter(({ frame }) => frame < branch.frame),
        ...one.markers,
      ],
    };
  }
  const crossing = scope(CatBorrowSection.Crossing);
  return count === 0 && crossing ? whole(crossing) : undefined;
};

/* `cat:branch:one-prize` leaves `two-prizes` exactly at its first release. */
const checkBranches = (scopes: readonly LottieMarkerScope[]) => {
  for (const scope of scopes) {
    const branch = find(
      scope.markers,
      CatBorrowMarker.Branch,
      CatBorrowSection.OnePrize,
    );
    if (!branch) continue;
    if (scope.marker?.argument !== CatBorrowSection.TwoPrizes)
      malformed('"cat:branch:one-prize" lies outside "two-prizes"');
    if (
      find(scope.markers, CatBorrowMarker.Release, '0')?.frame !== branch.frame
    )
      malformed('"cat:branch:one-prize" is not at "cat:release:0"');
  }
};

/* Every reference null a bind range names exists once, with a static position. */
const checkReferences = (
  rig: Rig,
  markers: readonly LottieNamespacedMarker[],
) => {
  rigLayer(rig, CatBorrowSlot.Root);
  rigLayer(rig, CatBorrowSlot.Facing);
  const names = new Set(
    markers
      .filter(({ kind }) => kind === CatBorrowMarker.Bind)
      .map(({ argument }) => argument),
  );
  names.forEach((name) =>
    staticPoint(rigLayer(rig, `${CAT_BORROW_ANCHOR_PREFIX}${name}`), 'p'),
  );
};

const buildStory = (
  rig: Rig,
  scopes: readonly LottieMarkerScope[],
  count: number,
  lastFrame: number,
): Story | undefined => {
  const path = pathFor(scopes, count);
  if (!path) return undefined;
  const end = buildSectionPath(path.ranges).at(-1)?.to ?? 0;
  if (end > lastFrame)
    malformed(`a ${count}-prize story ends after the composition`);
  const indices = Array.from({ length: count }, (_, index) => index);
  const stands = indices.map((index) =>
    authoredStand(rig, path.markers, index),
  );
  const pushes = indices.map((index) => {
    requireMarker(path.markers, CatBorrowMarker.Entry, String(index));
    return authoredPush(
      rig,
      index,
      path.ranges[0].from,
      requireMarker(path.markers, CatBorrowMarker.Release, String(index)).frame,
    );
  });
  if (!count) return { count, path, stands, pushes };
  requireMarker(path.markers, CatBorrowMarker.Restore);
  return {
    count,
    path,
    stands,
    pushes,
    landing: requireMarker(
      path.markers,
      CatBorrowMarker.Landing,
      String(count - 1),
    ),
  };
};

const findFloor = (data: Composition): Floor | undefined => {
  const floors = data.layers.filter(({ nm }) => nm === CatBorrowSlot.Floor);
  if (floors.length > 1) malformed('more than one "cat-floor" layer');
  const [layer] = floors;
  if (!layer) return undefined;
  const [group] = layer.shapes ?? [];
  const items = (group?.ty === 'gr' ? (group.it ?? []) : []) as Record<
    string,
    unknown
  >[];
  const rectangles = items.filter(({ ty }) => ty === 'rc');
  const gradients = items.filter(({ ty }) => ty === 'gf');
  if (
    layer.shapes?.length !== 1 ||
    rectangles.length !== 1 ||
    gradients.length !== 1
  )
    malformed('"cat-floor" is not one rectangle with a gradient');
  return { layer, rectangle: rectangles[0], gradient: gradients[0] };
};

const fitFloor = (
  data: Composition,
  floor: Floor | undefined,
  prizes: readonly CatBorrowPrize[],
  toStage: (point: Point) => Point,
  scale: number,
  viewport: { width: number; height: number },
) => {
  if (!floor) return;
  const grounded = prizes.filter(({ support }) => !support);
  if (!grounded.length) {
    data.layers = data.layers.filter((layer) => layer !== floor.layer);
    return;
  }
  const { rectangle, gradient } = floor;
  const left = Math.min(
    ...grounded.map(
      ({ target, side, pushPx }) => target.rect.left + side * pushPx,
    ),
  );
  const right = Math.max(
    ...grounded.map(
      ({ target, side, pushPx }) => target.rect.right + side * pushPx,
    ),
  );
  const x = Math.max(0, left - 12);
  const width = Math.min(viewport.width - x, right - left + 24);
  const center = toStage({ x: x + width / 2, y: viewport.height - 2 });
  const size = width / scale;
  rectangle.p = { a: 0, k: [center.x, center.y] };
  rectangle.s = { a: 0, k: [size, 4 / scale] };
  gradient.s = { a: 0, k: [center.x, center.y] };
  gradient.e = { a: 0, k: [center.x + size / 2, center.y] };
};

/**
 * Returns the cat-borrow preparation: a private copy of `data` mapped onto the
 * composer, with stations moved onto the measured buttons, the story and the
 * physical fall applied through the rig's time remap, the floor fitted, and
 * cloned copies of the borrowed buttons. Throws when the poster must show.
 */
export const prepareCatBorrowScene = (
  data: unknown,
  placement: CelebrationComposerAnchorPlacement,
  anchors: CelebrationAnchors,
): PackScenePreparation => {
  const mapping =
    resolveComposerAnchor(placement, anchors.composer, false) ??
    malformed('no composer and no stage anchor');
  const copy = rebaseStageOntoViewport(data, mapping) as Composition;
  if (!(copy.fr > 0)) malformed('no frame rate');
  /* Everything the asset can get wrong is checked before the page is measured. */
  const rig = findRig(copy);
  const scopes = readNamespacedMarkers(copy, CAT_BORROW_MARKERS, {
    from: 0,
    to: rig.end,
  });
  const allMarkers = scopes.flatMap(({ markers }) => markers);
  checkBranches(scopes);
  checkReferences(rig, allMarkers);
  const floor = findFloor(copy);
  const stories = STORY_COUNTS.flatMap(
    (count) => buildStory(rig, scopes, count, copy.op) ?? [],
  );
  if (!stories.length) malformed('no story section');

  const s = mapping.scale;
  const toStage = ({ x, y }: Point): Point => ({
    x: mapping.pivot.x + (x - mapping.origin.x) / s,
    y: mapping.pivot.y + (y - mapping.origin.y) / s,
  });
  const toRig = (point: Point): Point => {
    const stage = toStage(point);
    return { x: stage.x + rig.shift.x, y: stage.y + rig.shift.y };
  };
  const targets = mapping.source
    ? findBorrowTargets(anchors, mapping.source.element)
    : {
        width: mapping.viewportWidth,
        height: mapping.viewportHeight,
        buttons: [],
        supports: [],
      };
  let chosen:
    | {
        story: Story;
        prizes: CatBorrowPrize[];
        segments: LottieTimeRemapSegment[];
      }
    | undefined;
  /* A fall the elastic window cannot absorb makes its prize unreachable. */
  for (const story of stories) {
    const prizes = measurePrizes(targets, story.stands, story.pushes, s);
    if (prizes.length < story.count) continue;
    let segments: LottieTimeRemapSegment[] | undefined = buildSectionPath(
      story.path.ranges,
    );
    const { landing } = story;
    if (landing && landing.duration > 0) {
      const last = story.count - 1;
      segments = applyElasticRange(segments, {
        releaseFrame: requireMarker(
          story.path.markers,
          CatBorrowMarker.Release,
          String(last),
        ).frame,
        landingFrame: landing.frame,
        elasticFrames: landing.duration,
        physicalFallFrames: (copyFallMs(prizes[last].dropPx) / 1000) * copy.fr,
      });
    }
    if (segments) {
      chosen = { story, prizes, segments };
      break;
    }
  }
  if (!chosen) malformed('no section for this page');
  const { story, prizes, segments } = chosen;
  const { stands } = story;
  const width = mapping.viewportWidth;
  const height = mapping.viewportHeight;
  const measured: Record<string, LottieAnchorTarget> = {};
  const [first] = prizes;
  const last = prizes[prizes.length - 1];
  if (first && last && targets.composer) {
    const top = targets.composer.rect.top;
    measured[CatBorrowAnchor.Perch] = {
      point: toRig({ x: first.standX, y: top }),
      side: first.side,
    };
    measured[CatBorrowAnchor.EntryEdge] = {
      point: toRig({ x: first.side > 0 ? 0 : width, y: top }),
      side: first.side,
    };
    measured[CatBorrowAnchor.ExitEdge] = {
      point: toRig({
        x: last.side > 0 ? width : 0,
        y: last.target.rect.bottom,
      }),
      side: last.side,
    };
    /* The walk between two buttons faces the measured direction, whatever the authored one. */
    if (prizes.length > 1) {
      const moveFromX = first.standX + first.side * first.pushPx;
      measured[CatBorrowAnchor.Move] = {
        point: toRig({ x: moveFromX, y: first.target.rect.bottom }),
        side: (Math.sign(last.standX - moveFromX) || last.side) as 1 | -1,
      };
    }
    prizes.forEach(({ target, side }, index) => {
      measured[`prize-${index}`] = {
        point: toRig({
          x: side > 0 ? target.rect.left : target.rect.right,
          y: target.rect.bottom,
        }),
        side,
      };
    });
  } else {
    measured[CatBorrowAnchor.EntryEdge] = {
      point: toRig({ x: 0, y: height - CROSSING_LIFT_PX }),
      side: 1,
    };
    measured[CatBorrowAnchor.ExitEdge] = {
      point: toRig({ x: width, y: height - CROSSING_LIFT_PX }),
      side: 1,
    };
  }
  rig.asset.layers = bindStationKeyframes(rig.asset.layers, {
    positionLayer: CatBorrowSlot.Root,
    facingLayer: CatBorrowSlot.Facing,
    referencePrefix: CAT_BORROW_ANCHOR_PREFIX,
    bindings: allMarkers.filter(({ kind }) => kind === CatBorrowMarker.Bind),
    anchors: measured,
  });
  rig.layer.tm = toTimeRemapProperty(segments, copy.fr);
  /* `buildStory` keeps every story within the composition. */
  const end = segments[segments.length - 1].to;
  if (end < copy.op) {
    copy.op = end;
    copy.layers.forEach((layer) => {
      layer.op = Math.min(layer.op ?? end, end);
    });
  }
  fitFloor(copy, floor, prizes, toStage, s, { width, height });
  const preparation: PackScenePreparation = {
    data: copy,
    aspectRatio: (data as Composition).w / (data as Composition).h,
    anchor: mapping as ComposerAnchorMapping,
  };
  /* The crossing borrows nothing, so it installs no copies, listeners or observers. */
  if (!prizes.length) return preparation;
  const durationMs = (end / copy.fr) * 1000;
  const toMs = (local: number) =>
    ((toCompositionFrame(segments, local) ??
      malformed(`frame ${local} never plays`)) /
      copy.fr) *
    1000;
  const { markers } = story.path;
  const restoreMs = toMs(requireMarker(markers, CatBorrowMarker.Restore).frame);
  const restoreAt = restoreMs / durationMs;
  /* Resolved here, so nothing about the asset can fail once playback starts. */
  const hideAts = prizes.map((_, index) => {
    const hideAt =
      toMs(requireMarker(markers, CatBorrowMarker.Entry, String(index)).frame) /
      durationMs;
    if (!(hideAt >= SNAPSHOT_HIDE_FADE_SHARE && hideAt <= restoreAt))
      malformed(`"cat:entry:${index}" lies outside the story's hide window`);
    return hideAt;
  });
  const frames = prizes.map((prize, index) => {
    const release = requireMarker(
      markers,
      CatBorrowMarker.Release,
      String(index),
    );
    const track = copyTrackKeyframes(rigLayer(rig, `prize-${index}`), {
      durationMs,
      toCompositionMs: toMs,
      releaseFrame: release.frame,
      fromFrame: story.path.ranges[0].from,
      mirror: (prize.side * stands[index].side) as 1 | -1,
      scale: s,
    });
    return appendCopyFall(track, {
      durationMs,
      releaseMs: toMs(release.frame),
      dropPx: prize.dropPx,
      widthPx: prize.target.rect.width,
      side: prize.side,
      restoreMs,
      reboundHeightPx:
        index === prizes.length - 1
          ? Math.min(
              prize.dropPx * REBOUND_DROP_SHARE,
              CAT_BORROW_REFERENCE_SIZE * REBOUND_MAX_SIZES * s,
            )
          : undefined,
    });
  });
  const handlers: CatBorrowPreparation['handlers'] = {};
  const copies = prepareCelebrationSnapshots(
    prizes.map(({ target }) => target),
    {
      durationMs,
      hideAt: (index) => hideAts[index],
      restoreAt,
      restoreShare: COPY_RESTORE_SHARE,
      frames: (_rect, index) => frames[index],
      decorateCopy: (element, index) => {
        element.dataset.catPrize = String(index);
      },
      onStop: () => handlers.onCopiesStopped?.(),
    },
  );
  return {
    ...preparation,
    companion: {
      kind: PackSceneCompanionKind.CatBorrow,
      copies,
      watched: prizes.flatMap(({ target, support }) =>
        support ? [target, support] : [target],
      ),
      restoreMs,
      handlers,
    },
  };
};

/** Attaches the copies beneath the renderer and watches the borrowed buttons. */
export const onCatBorrowAnimationCreated = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<PackScenePreparation>): void => {
  const { companion: borrow } = preparation;
  if (borrow?.kind !== PackSceneCompanionKind.CatBorrow) return;
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
    borrow.copies.stop();
    layer.remove();
  });
  host.prepend(layer);
  borrow.copies.attach(layer);
  /* A stop before the restore means the copies saw an interruption. */
  borrow.handlers.onCopiesStopped = () => {
    const { startedAtMs } = borrow.handlers;
    if (startedAtMs === undefined) return;
    const now = document.timeline?.currentTime;
    const elapsed =
      (typeof now === 'number' ? now : performance.now()) - startedAtMs;
    if (elapsed < borrow.restoreMs) cancel();
  };
  /* Compared against the rectangles the copies were cloned at. */
  addDisposer(observeSceneTargets(borrow.watched, cancel, [host]));
};

/** Starts the copies and the originals' opacity on the Lottie clock. */
export const onCatBorrowPlaybackStarted = ({
  preparation,
  timelineZeroMs,
}: LottiePlaybackStartContext<PackScenePreparation>): void => {
  const { companion: borrow } = preparation;
  if (borrow?.kind !== PackSceneCompanionKind.CatBorrow) return;
  borrow.handlers.startedAtMs = timelineZeroMs;
  borrow.copies.start(timelineZeroMs);
};
