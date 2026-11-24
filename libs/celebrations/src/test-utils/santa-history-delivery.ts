import type { CelebrationSceneDescriptor } from '../models/celebration-pack';
import {
  CelebrationCapability,
  CelebrationDirectionMode,
  CelebrationLayout,
  CelebrationPlacementTemplate,
  CelebrationStageAlign,
  CelebrationStageFit,
} from '../types/celebration-pack';

/** Exact unpublished Themes authoring source; this is not a released pack. */
export const SANTA_HISTORY_SOURCE = {
  repository: 'epam/ai-dial-chat-themes',
  revision: '14477f5dea0541bafa0997f3d981f4fbea9eb805',
  path: 'authoring/santa-history-delivery',
  status: 'unpublished representative interaction',
} as const;

/** Native source identities for reproducible browser previews. */
export const SANTA_HISTORY_ASSETS = {
  desktop: {
    assetId: 'santa-history-desktop',
    file: 'santa-history-delivery.desktop.0f2b71021b89f641.json',
    bytes: 118353,
    sha256: '0f2b71021b89f6417aa98e6710ced97c9af0824ce0186ddaf364ad75a9ae099e',
  },
  mobile: {
    assetId: 'santa-history-mobile',
    file: 'santa-history-delivery.mobile.45241e4de535e5a0.json',
    bytes: 118560,
    sha256: '45241e4de535e5a0ec56891d9b28b07d48ef96bcedd2f4176e874a83d9992b07',
  },
  poster: {
    assetId: 'santa-history-poster',
    file: 'santa-history-delivery.poster.dbf68dbaca2e2cac.svg',
    bytes: 18530,
    sha256: 'dbf68dbaca2e2cacddc5962eb022228afd7e39eca13d3d6ce75a620184ef3a71',
  },
} as const;

/** First interaction through the generic production history adapter. */
export const santaHistoryDeliveryScene = (): CelebrationSceneDescriptor => ({
  id: 'santa-history-delivery',
  labelId: 'santaHistoryDeliveryToastMessage',
  renderer: CelebrationCapability.LottieLightSvgV1,
  requiredCapabilities: [
    CelebrationCapability.LottieLightSvgV1,
    CelebrationCapability.ViewportStageV1,
    'interaction-history-ladder-v1',
    CelebrationCapability.StaticPosterV1,
  ],
  placement: {
    template: CelebrationPlacementTemplate.ViewportStageV1,
    fit: CelebrationStageFit.Contain,
    align: CelebrationStageAlign.Center,
  },
  direction: CelebrationDirectionMode.None,
  timing: {
    playbackDurationMs: 12000,
    loadTimeoutMs: 2000,
    readyTimeoutMs: 250,
    maxLifetimeMs: 14500,
  },
  posterAssetId: SANTA_HISTORY_ASSETS.poster.assetId,
  posterDurationMs: 4000,
  variants: [
    {
      when: { layout: CelebrationLayout.Desktop },
      animationAssetId: SANTA_HISTORY_ASSETS.desktop.assetId,
    },
    {
      when: { layout: CelebrationLayout.Mobile },
      animationAssetId: SANTA_HISTORY_ASSETS.mobile.assetId,
    },
  ],
});
