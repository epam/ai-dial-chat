import type {
  CelebrationAssetLoaders,
  CelebrationSceneDescriptor,
} from '../models/celebration-pack';
import desktop from '../stories/fixtures/snow-circus.desktop.lottie.json';
import mobile from '../stories/fixtures/snow-circus.mobile.lottie.json';
import poster from '../stories/fixtures/snow-circus.poster.svg';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationCapability,
  CelebrationDirectionMode,
  CelebrationLayout,
  CelebrationPlacementTemplate,
} from '../types/celebration-pack';

/** Snow Circus's real pack descriptor for the production-player preview. */
export const snowCircusScene: CelebrationSceneDescriptor = {
  id: 'snow-circus',
  labelId: 'snowCircusToastMessage',
  renderer: CelebrationCapability.LottieLightSvgV1,
  requiredCapabilities: [
    CelebrationCapability.LottieLightSvgV1,
    CelebrationCapability.ComposerAnchorV1,
    CelebrationCapability.InteractionButtonPropsV1,
    CelebrationCapability.StaticPosterV1,
  ],
  direction: CelebrationDirectionMode.None,
  placement: {
    template: CelebrationPlacementTemplate.ComposerAnchorV1,
    anchor: CelebrationAnchor.Composer,
    anchorRect: { x: 0, y: 300, width: 520, height: 56 },
    edge: CelebrationAnchorEdge.Top,
    scale: { min: 0.58, max: 0.9 },
    fallback: CelebrationAnchorFallback.StageAnchor,
  },
  timing: {
    playbackDurationMs: 26000,
    loadTimeoutMs: 2000,
    readyTimeoutMs: 250,
    maxLifetimeMs: 28250,
  },
  posterAssetId: 'snow-circus-poster',
  posterDurationMs: 3000,
  variants: [
    {
      when: { layout: CelebrationLayout.Desktop },
      animationAssetId: 'snow-circus-desktop',
    },
    {
      when: { layout: CelebrationLayout.Mobile },
      animationAssetId: 'snow-circus-mobile',
    },
  ],
};

/** Loads maintained native artwork, with no generation at activation. */
export const snowCircusLoaders: CelebrationAssetLoaders = {
  loadAnimationData: async (id, signal) => {
    signal.throwIfAborted();
    return id === 'snow-circus-mobile' ? mobile : desktop;
  },
  resolveImageUrl: () => poster,
};
