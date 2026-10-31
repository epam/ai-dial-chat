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
  resolvePosterObjectPosition,
  type PackScenePreparation,
} from '../../utils/celebration-pack-scene';
import {
  resolveStageAlignment,
  selectCelebrationVariant,
} from '../../utils/celebration-variant';
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
  const { isMobile } = useCelebrationEnvironment();
  const isReducedMotion = useReducedMotion();
  /* Layout and motion preference are fixed at activation; a change ends the scene. */
  const [initial] = useState(() => ({ isMobile, isReducedMotion }));
  const isChanged =
    initial.isMobile !== isMobile ||
    initial.isReducedMotion !== isReducedMotion;
  const [variant] = useState(() =>
    isCelebrationSceneSupported(scene)
      ? selectCelebrationVariant(scene.variants, {
          ...context,
          layout: initial.isMobile
            ? CelebrationLayout.Mobile
            : CelebrationLayout.Desktop,
        })
      : undefined,
  );
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const [isPosterExpired, setIsPosterExpired] = useState(false);

  const playback = useMemo<LottieScenePlayback<PackScenePreparation>>(
    () => ({
      timings: {
        loadTimeoutMs: scene.timing.loadTimeoutMs,
        readyTimeoutMs: scene.timing.readyTimeoutMs,
        playbackMs: scene.timing.playbackDurationMs,
      },
      ownership: LottieDataOwnership.Shared,
      getAnimationData: ({ data }) => data,
      isRendererAccepted: isPackRendererWithinBudget,
      onPlaybackStarted: () => setHasPlaybackStarted(true),
    }),
    [scene.timing],
  );
  const animationAssetId = variant?.animationAssetId;
  const loadData = useCallback(
    (signal: AbortSignal) =>
      animationAssetId
        ? loaders.loadAnimationData(animationAssetId, signal)
        : Promise.reject(new Error('No variant')),
    [animationAssetId, loaders],
  );
  const { phase, preparation, hostRef } = useLottieSceneSession({
    enabled: !initial.isReducedMotion && variant !== undefined && !isChanged,
    playback,
    prepare: (_player, data) => preparePackSceneData(data),
    loadData,
  });

  const isPoster =
    !isChanged &&
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

  const alignment = resolveStageAlignment(scene.placement.align);
  const isMirrored =
    scene.direction === CelebrationDirectionMode.Mirror &&
    context.direction === 'rtl';
  const isCover = scene.placement.fit === CelebrationStageFit.Cover;
  const sceneClassName = mergeClasses(
    styles.scene,
    BLOCK_CLASS[alignment.block],
    INLINE_CLASS[alignment.inline],
  );

  if (isChanged) return null;
  if (isPoster) {
    if (!isPosterVisible) return null;
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
