import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FC,
} from 'react';
import { useCelebrationEnvironment } from '../../context/CelebrationEnvironmentContext';
import { useComposerInterrupts } from '../../hooks/useComposerInterrupts';
import { useLottieSceneSession } from '../../hooks/useLottieSceneSession';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type {
  CelebrationAssetLoaders,
  CelebrationSceneDescriptor,
  CelebrationVariantContext,
} from '../../models/celebration-pack';
import type { LottieScenePlayback } from '../../models/lottie-scene';
import {
  CelebrationDirectionMode,
  CelebrationLayout,
  CelebrationPlacementTemplate,
  CelebrationStageAlign,
  CelebrationStageEdge,
  CelebrationStageFit,
} from '../../types/celebration-pack';
import {
  LottieDataOwnership,
  LottieScenePhase,
} from '../../types/lottie-scene';
import {
  isCelebrationSceneSupported,
  isPackRendererWithinBudget,
  preparePackSceneData,
  resolveVariantPlacement,
  resolvePosterObjectPosition,
  requiresHistoryLadder,
  type PackScenePreparation,
} from '../../utils/celebration-pack-scene';
import {
  resolveStageAlignment,
  selectCelebrationVariant,
} from '../../utils/celebration-variant';
import { resolvePackSceneAdapter } from '../../utils/pack-scene-adapter';
import { ComposerCornerPoster } from '../ComposerCornerPoster/ComposerCornerPoster';
import styles from './LottieScene.module.scss';

/** Props of `LottieScene`. */
export interface LottieSceneProps {
  /** The validated scene to play. */
  scene: CelebrationSceneDescriptor;
  /** Host callbacks that load the animation and resolve the poster URL. */
  loaders: CelebrationAssetLoaders;
  /** Host direction and color scheme at activation. */
  context: CelebrationVariantContext;
}

const BLOCK_CLASS: Record<CelebrationStageEdge, string> = {
  [CelebrationStageEdge.Start]: styles.blockStart,
  [CelebrationStageEdge.Center]: styles.blockCenter,
  [CelebrationStageEdge.End]: styles.blockEnd,
};

const INLINE_CLASS: Record<CelebrationStageEdge, string> = {
  [CelebrationStageEdge.Start]: styles.inlineStart,
  [CelebrationStageEdge.Center]: styles.inlineCenter,
  [CelebrationStageEdge.End]: styles.inlineEnd,
};

/** Plays one pack scene in the viewport scene layer, or its poster when it cannot play. */
export const LottieScene: FC<LottieSceneProps> = ({
  scene,
  loaders,
  context,
}) => {
  const { anchors, isMobile } = useCelebrationEnvironment();
  const isReducedMotion = useReducedMotion();
  const isHistoryLadder = requiresHistoryLadder(scene);
  const hasSafePoster = isHistoryLadder;
  /* Plain viewport scenes have no interaction adapter. */
  const [adapter] = useState(() => resolvePackSceneAdapter(scene));
  /* Layout, anchors and motion preference are fixed at activation; a change ends the scene. */
  const [initial] = useState(() => ({
    anchors,
    isMobile,
    isReducedMotion,
    direction: context.direction,
    colorScheme: context.colorScheme,
  }));
  const isChanged =
    initial.isMobile !== isMobile ||
    initial.isReducedMotion !== isReducedMotion ||
    initial.direction !== context.direction ||
    initial.colorScheme !== context.colorScheme ||
    (adapter?.watchedAnchors.some(
      (name) => initial.anchors[name] !== anchors[name],
    ) ??
      false);
  const [isAdapterAvailable] = useState(() => adapter?.isAvailable() ?? true);
  /* The variant and its placement are chosen together; a variant that changes
     the template makes the scene unsupported. */
  const [selected] = useState(() => {
    if (!isCelebrationSceneSupported(scene) || !isAdapterAvailable)
      return undefined;
    const match = selectCelebrationVariant(scene.variants, {
      ...context,
      layout: initial.isMobile
        ? CelebrationLayout.Mobile
        : CelebrationLayout.Desktop,
    });
    const matchPlacement = match && resolveVariantPlacement(scene, match);
    return match && matchPlacement
      ? { variant: match, placement: matchPlacement }
      : undefined;
  });
  const variant = selected?.variant;
  const placement = selected?.placement ?? scene.placement;
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const [isPosterExpired, setIsPosterExpired] = useState(false);
  const isMirrored =
    scene.direction === CelebrationDirectionMode.Mirror &&
    context.direction === 'rtl';

  const playback = useMemo<LottieScenePlayback<PackScenePreparation>>(
    () => ({
      timings: {
        loadTimeoutMs: scene.timing.loadTimeoutMs,
        readyTimeoutMs: scene.timing.readyTimeoutMs,
        playbackMs: scene.timing.playbackDurationMs,
      },
      /* An anchored preparation is a private copy built for one session. */
      ownership: adapter
        ? LottieDataOwnership.Transferred
        : LottieDataOwnership.Shared,
      getAnimationData: ({ data }) => data,
      isRendererAccepted: isPackRendererWithinBudget,
      onAnimationCreated: adapter?.onAnimationCreated,
      onPlaybackStarted: (started) => {
        setHasPlaybackStarted(true);
        adapter?.onPlaybackStarted?.(started);
      },
    }),
    [scene.timing, adapter],
  );
  const animationAssetId = variant?.animationAssetId;
  const loadData = useCallback(
    (signal: AbortSignal) =>
      animationAssetId
        ? loaders.loadAnimationData(animationAssetId, signal)
        : Promise.reject(new Error('No variant')),
    [animationAssetId, loaders],
  );
  const { phase, preparation, hostRef, cancel } = useLottieSceneSession({
    enabled: !initial.isReducedMotion && variant !== undefined && !isChanged,
    playback,
    /* Runs after the player and data load, so the composer is measured as it is then. */
    prepare: (_player, data) => {
      if (!adapter) return preparePackSceneData(data);
      return adapter.prepare(data, placement, {
        anchors: initial.anchors,
        isMirrored,
        isMobile: initial.isMobile,
        direction: context.direction,
      });
    },
    loadData,
  });

  useComposerInterrupts(
    Boolean(adapter) &&
      !isChanged &&
      (phase === LottieScenePhase.Loading ||
        phase === LottieScenePhase.Prepared),
    cancel,
  );

  useEffect(() => {
    if (isChanged) cancel();
  }, [isChanged, cancel]);

  const isPoster =
    !isChanged &&
    (!hasSafePoster || phase !== LottieScenePhase.Ended) &&
    (initial.isReducedMotion ||
      variant === undefined ||
      (phase === LottieScenePhase.Failed && !hasPlaybackStarted));
  const posterUrl = isPoster
    ? loaders.resolveImageUrl(scene.posterAssetId)
    : undefined;
  const isPosterVisible = posterUrl !== undefined && !isPosterExpired;

  useEffect(() => {
    if (!isPosterVisible) return;
    const timer = window.setTimeout(
      () => setIsPosterExpired(true),
      scene.posterDurationMs,
    );
    return () => window.clearTimeout(timer);
  }, [isPosterVisible, scene.posterDurationMs]);

  /* An anchored scene's poster sits at the bottom center, like its composer. */
  const alignment = resolveStageAlignment(
    placement.template === CelebrationPlacementTemplate.ViewportStageV1
      ? placement.align
      : CelebrationStageAlign.Bottom,
  );
  const isCover =
    placement.template === CelebrationPlacementTemplate.ViewportStageV1 &&
    placement.fit === CelebrationStageFit.Cover;
  const sceneClassName = mergeClasses(
    styles.scene,
    BLOCK_CLASS[alignment.block],
    INLINE_CLASS[alignment.inline],
  );

  if (isChanged) return null;
  if (isPoster) {
    if (!isPosterVisible || !posterUrl) return null;
    if (hasSafePoster)
      return (
        <ComposerCornerPoster
          src={posterUrl}
          anchors={anchors}
          direction={context.direction}
          isMirrored={isMirrored}
          protectHistory={isHistoryLadder}
          onDismiss={cancel}
        />
      );
    return (
      <div className={sceneClassName} dir={context.direction} inert>
        <img
          alt=""
          src={posterUrl}
          className={mergeClasses(
            styles.poster,
            isCover && styles.posterCover,
            isMirrored && styles.mirrored,
          )}
          style={{
            objectPosition: resolvePosterObjectPosition(
              alignment,
              context.direction,
              isMirrored,
            ),
          }}
        />
      </div>
    );
  }
  if (!preparation || phase !== LottieScenePhase.Prepared) return null;
  if (preparation.anchor || preparation.isViewportMapped)
    return (
      <div
        ref={hostRef}
        className={styles.anchoredStage}
        dir={context.direction}
        inert
        data-celebration-anchor={
          preparation.anchor?.source ? 'composer' : 'stage-anchor'
        }
      />
    );
  return (
    <div className={sceneClassName} dir={context.direction} inert>
      <div
        ref={hostRef}
        className={mergeClasses(
          styles.stage,
          isCover && styles.cover,
          isMirrored && styles.mirrored,
        )}
        style={
          {
            '--celebrations-stage-ratio': String(preparation.aspectRatio),
          } as CSSProperties
        }
      />
    </div>
  );
};
