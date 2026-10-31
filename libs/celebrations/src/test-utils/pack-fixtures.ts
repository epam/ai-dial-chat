import type {
  CelebrationPackDescriptor,
  CelebrationSceneDescriptor,
} from '../models/celebration-pack';
import {
  CelebrationCapability,
  CelebrationDecorationTemplate,
  CelebrationDirectionMode,
  CelebrationLayout,
  CelebrationPlacementTemplate,
  CelebrationStageAlign,
  CelebrationStageFit,
} from '../types/celebration-pack';

/** A validated `snowman-delivery` scene shaped like the contract example. */
export const packSceneFixture = (
  overrides: Partial<CelebrationSceneDescriptor> = {},
): CelebrationSceneDescriptor => ({
  id: 'snowman-delivery',
  labelId: 'snowmanDeliveryToastMessage',
  renderer: CelebrationCapability.LottieLightSvgV1,
  requiredCapabilities: [
    CelebrationCapability.LottieLightSvgV1,
    CelebrationCapability.ViewportStageV1,
    CelebrationCapability.StaticPosterV1,
  ],
  placement: {
    template: CelebrationPlacementTemplate.ViewportStageV1,
    fit: CelebrationStageFit.Contain,
    align: CelebrationStageAlign.Bottom,
  },
  direction: CelebrationDirectionMode.Mirror,
  timing: {
    playbackDurationMs: 12000,
    loadTimeoutMs: 2000,
    readyTimeoutMs: 250,
    maxLifetimeMs: 15000,
  },
  posterAssetId: 'snowman-poster',
  posterDurationMs: 4000,
  variants: [
    {
      when: { layout: CelebrationLayout.Desktop },
      animationAssetId: 'snowman-desktop',
    },
    {
      when: { layout: CelebrationLayout.Mobile },
      animationAssetId: 'snowman-mobile',
    },
  ],
  ...overrides,
});

/** An external-only `company-anniversary` pack with one `confetti` scene. */
export const externalPackFixture = (
  overrides: Partial<CelebrationPackDescriptor> = {},
): CelebrationPackDescriptor => ({
  packId: 'company-anniversary',
  version: '1.0.0',
  eventId: 'company-anniversary',
  scenes: [
    packSceneFixture({
      id: 'confetti',
      labelId: 'confettiToastMessage',
      direction: CelebrationDirectionMode.None,
      variants: [{ when: {}, animationAssetId: 'confetti-any' }],
      posterAssetId: 'confetti-poster',
    }),
  ],
  labels: {
    title: 'Happy anniversary',
    confettiToastMessage: 'Thanks for being with us',
    trigger: '',
  },
  event: {
    titleLabelId: 'title',
    clickSceneIds: ['confetti', 'missing'],
    iconAssetId: 'anniversary-icon',
    decoration: {
      template: CelebrationDecorationTemplate.StaticTriggerV1,
      posterAssetId: 'anniversary-trigger',
      labelId: 'trigger',
    },
  },
  ...overrides,
});

/** A minimal Lottie composition with a stage size. */
export const lottieFixture = () => ({
  v: '5.13.0',
  fr: 60,
  ip: 0,
  op: 720,
  w: 1440,
  h: 900,
  layers: [],
});
