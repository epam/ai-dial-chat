import type { CelebrationPlacementDescriptor } from '../models/celebration-pack';
import type {
  HistoryLadderMetadata,
  HistoryLadderPreparation,
} from '../models/history-ladder';
import type { LottieAnchorTarget } from '../models/lottie-anchor-binding';
import type { LottieLayer, Point } from '../models/lottie-composition';
import type {
  LottieAnimationContext,
  LottiePlaybackStartContext,
} from '../models/lottie-scene';
import { CelebrationPlacementTemplate } from '../types/celebration-pack';
import { HistoryLadderMode, HistoryLadderTrack } from '../types/history-ladder';
import { PackSceneCompanionKind } from '../types/pack-scene';
import type { PackScenePreparation } from './celebration-pack-scene';
import { prepareCelebrationSnapshots } from './celebration-snapshots';
import { getVisibleViewport } from './composer-corner-geometry';
import { COPY_INTERACTION_EVENTS } from './copy-layers';
import {
  HISTORY_LADDER_FOLLOW_PREFIX,
  HISTORY_LADDER_REFERENCE_PREFIX,
  readHistoryLadderMetadata,
} from './history-ladder-contract';
import { isHistoryLadderCopyPathSafe } from './history-ladder-copy';
import { resolveHistoryLadderGeometry } from './history-ladder-geometry';
import {
  historyViewportPoints,
  isHistoryViewportRouteSafe,
  mapHistoryTopLine,
} from './history-ladder-viewport';
import { bindTrackLayers } from './lottie-anchor-binding';
import {
  COPY_RESTORE_SHARE,
  copyPathKeyframes,
} from './lottie-track-keyframes';
import type { PackSceneAdapterEnvironment } from './pack-scene-adapter';
import { observeSceneTargets } from './scene-targets';

const boundLayers = (
  metadata: HistoryLadderMetadata,
  points: Readonly<Record<string, Point>>,
  side: 1 | -1,
): LottieLayer[] => {
  const anchors: Record<string, LottieAnchorTarget> = Object.fromEntries(
    Object.entries(points).map(([name, point]) => [name, { point, side }]),
  );
  let layers = metadata.composition.layers;
  for (const kind of Object.values(HistoryLadderTrack)) {
    if (!metadata.bindings[kind].length) continue;
    const name = `hl-track:${kind}`;
    layers = bindTrackLayers(layers, {
      trackLayers: [name],
      referencePrefix: HISTORY_LADDER_REFERENCE_PREFIX,
      bindings: metadata.bindings[kind],
      anchors,
    });
    layers = layers.map((layer) => {
      if (layer.nm !== name) return layer;
      const rotation = layer.ks?.r;
      let mappedRotation = rotation;
      if (rotation && side < 0)
        mappedRotation = {
          ...rotation,
          k:
            rotation.a === 1
              ? (rotation.k as { t: number; s: number[] }[]).map((key) => ({
                  ...key,
                  s: key.s.map((value) => -value),
                }))
              : -Number(rotation.k),
        };
      return {
        ...layer,
        ks: {
          ...layer.ks,
          r: mappedRotation,
          s: { a: 0, k: [side * 100, 100, 100] },
        },
      };
    });
  }
  return bindTrackLayers(layers, {
    trackLayers: [],
    referencePrefix: HISTORY_LADDER_REFERENCE_PREFIX,
    followPrefix: HISTORY_LADDER_FOLLOW_PREFIX,
    bindings: [],
    anchors,
  });
};

/** Prepares one bounded history route or the complete authored drawn ladder. */
export const prepareHistoryLadderScene = (
  data: unknown,
  placement: CelebrationPlacementDescriptor,
  { anchors, direction }: PackSceneAdapterEnvironment,
): PackScenePreparation => {
  if (placement.template !== CelebrationPlacementTemplate.ViewportStageV1)
    throw new TypeError('History ladder requires viewport placement');
  const metadata = readHistoryLadderMetadata(data);
  const viewport = getVisibleViewport(false);
  if (!viewport) throw new Error('No visible history viewport');
  const plan = resolveHistoryLadderGeometry({
    anchors,
    direction,
    references: metadata.references,
    bounds: metadata.bounds,
    drawnBounds: metadata.drawnBounds,
    maxGap: metadata.maxGap,
    maxDrift: metadata.maxDrift,
    copyAnchor: metadata.copyAnchor,
    useStartEdge: metadata.useStartEdge,
    isRouteSafe: (points, side, _safeViewport, protectedRects, mode) => {
      const targets = historyViewportPoints(points, side, viewport);
      return isHistoryViewportRouteSafe(
        metadata,
        boundLayers(metadata, targets, side),
        side,
        viewport,
        protectedRects,
        mode,
      );
    },
    isCopyPathSafe: (copy, points, side, safeViewport, protectedRects) => {
      const track = boundLayers(
        metadata,
        historyViewportPoints(points, side, viewport),
        side,
      ).find(({ nm }) => nm === 'hl-track:copy') as LottieLayer;
      return isHistoryLadderCopyPathSafe(
        track,
        copy.rect.width,
        copy.rect.height,
        metadata.useStartEdge ? (side === 1 ? -1 : 1) : side,
        safeViewport,
        protectedRects,
      );
    },
  });
  if (!plan) throw new Error('No safe history ladder route');
  const mapped = boundLayers(
    metadata,
    historyViewportPoints(plan.points, plan.side, viewport),
    plan.side,
  );
  const rejectedMode =
    plan.mode === HistoryLadderMode.History
      ? HistoryLadderMode.Drawn
      : HistoryLadderMode.History;
  const byIndex = new Map(mapped.map((layer) => [layer.ind, layer]));
  const isRejected = (layer: LottieLayer): boolean => {
    let ancestor: LottieLayer | undefined = layer;
    while (ancestor) {
      if (
        ancestor.nm === `hl-if:${rejectedMode}` ||
        ancestor.nm?.startsWith(`hl-if:${rejectedMode}:`)
      )
        return true;
      ancestor =
        ancestor.parent === undefined
          ? undefined
          : byIndex.get(ancestor.parent);
    }
    return false;
  };
  const composition = structuredClone({
    ...metadata.composition,
    w: plan.width,
    h: plan.height,
    layers: mapped
      .filter(
        ({ nm }) =>
          !nm?.startsWith(HISTORY_LADDER_REFERENCE_PREFIX) &&
          !nm?.startsWith('hl-bounds:') &&
          nm !== 'hl-range' &&
          nm !== 'hl-drawn-bounds' &&
          nm !== 'hl-flight-bounds',
      )
      .map((layer) => (isRejected(layer) ? { ...layer, hd: true } : layer)),
  });
  mapHistoryTopLine(composition.layers, viewport);
  const durationMs = (metadata.composition.op / metadata.composition.fr) * 1000;
  const restoreMs = (metadata.restore / metadata.composition.fr) * 1000;
  const handlers: HistoryLadderPreparation['handlers'] = {};
  let copy;
  if (plan.copy) {
    const track = mapped.find(
      ({ nm }) => nm === 'hl-track:copy',
    ) as LottieLayer;
    const frames = copyPathKeyframes(track, {
      durationMs,
      frameRate: composition.fr,
      segments: [
        { from: 0, to: composition.op, localFrom: 0, localTo: composition.op },
      ],
      origin: plan.points[metadata.copyAnchor],
      scale: 1,
    });
    copy = prepareCelebrationSnapshots([plan.copy], {
      durationMs,
      hideAt: metadata.entry / composition.op,
      restoreAt: metadata.restore / composition.op,
      restoreShare: COPY_RESTORE_SHARE,
      frames: () => frames,
      decorateCopy: (element) => {
        const atStart = metadata.useStartEdge ? plan.side > 0 : plan.side < 0;
        element.style.transformOrigin = atStart ? '0% 0%' : '100% 0%';
      },
      onStop: () => handlers.onCopyStopped?.(),
    });
  }
  return {
    data: composition,
    aspectRatio: plan.width / plan.height,
    isViewportMapped: true,
    companion: {
      kind: PackSceneCompanionKind.HistoryLadder,
      mode: plan.mode,
      copy,
      watched: plan.watched,
      hasTargetSetChanged: plan.hasTargetSetChanged,
      restoreMs,
      handlers,
    },
  };
};

/** Attaches one optional copy and cancels the mapped route when its host changes. */
export const onHistoryLadderAnimationCreated = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<PackScenePreparation>): void => {
  const companion = preparation.companion;
  if (companion?.kind !== PackSceneCompanionKind.HistoryLadder) return;
  const { copy } = companion;
  if (copy) {
    const layer = document.createElement('div');
    layer.setAttribute('data-history-ladder-copies', '');
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    });
    addDisposer(() => {
      copy.stop();
      layer.remove();
    });
    host.prepend(layer);
    copy.attach(layer);
    companion.handlers.onCopyStopped = () => {
      const startedAt = companion.handlers.startedAtMs;
      const clock = document.timeline?.currentTime;
      const now = typeof clock === 'number' ? clock : performance.now();
      if (startedAt !== undefined && now - startedAt < companion.restoreMs)
        cancel();
    };
  }
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
  window.visualViewport?.addEventListener('resize', cancel);
  window.visualViewport?.addEventListener('scroll', cancel);
  addDisposer(() => {
    COPY_INTERACTION_EVENTS.forEach((name) =>
      document.removeEventListener(name, onInteraction, true),
    );
    window.removeEventListener('resize', cancel);
    window.visualViewport?.removeEventListener('resize', cancel);
    window.visualViewport?.removeEventListener('scroll', cancel);
  });
  addDisposer(
    observeSceneTargets(
      companion.watched,
      cancel,
      [host],
      companion.hasTargetSetChanged,
    ),
  );
};

/** Starts the inert row copy on the native player's existing frame-zero clock. */
export const onHistoryLadderPlaybackStarted = ({
  preparation,
  timelineZeroMs,
}: LottiePlaybackStartContext<PackScenePreparation>): void => {
  const companion = preparation.companion;
  if (companion?.kind !== PackSceneCompanionKind.HistoryLadder) return;
  companion.handlers.startedAtMs = timelineZeroMs;
  companion.copy?.start(timelineZeroMs);
};
