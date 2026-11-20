import type { CelebrationSceneDescriptor } from '../models/celebration-pack';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationCapability,
  CelebrationDirectionMode,
  CelebrationLayout,
  CelebrationPlacementTemplate,
} from '../types/celebration-pack';

/** A published pack asset pinned as a Storybook fixture. */
export interface PinnedPackAsset {
  /** Asset id the pack manifest declares. */
  assetId: string;
  /** File name in the pack directory and under `fixtures/external/`. */
  file: string;
  /** Byte length the pack manifest declares. */
  bytes: number;
  /** SHA-256 the pack manifest declares, as lowercase hex. */
  sha256: string;
}

/** The pack version the external GiftWrapping fixtures come from. */
export const EXTERNAL_GIFT_WRAPPING_PACK = {
  packId: 'new-year-default',
  version: '1.1.1',
} as const;

/* Copied from `new-year-default/1.1.1/manifest.json` in epam/ai-dial-chat-themes. */
export const EXTERNAL_GIFT_WRAPPING_ASSETS = {
  desktop: {
    assetId: 'new-year-default-gift-wrapping-desktop-28260bbcf8f593a6',
    file: 'gift-wrapping.desktop.28260bbcf8f593a6.json',
    bytes: 112711,
    sha256: '28260bbcf8f593a605aabb29c2230d88798d1636e4c198ca5c806454709c50e7',
  },
  mobile: {
    assetId: 'new-year-default-gift-wrapping-mobile-3d541976f665e859',
    file: 'gift-wrapping.mobile.3d541976f665e859.json',
    bytes: 111848,
    sha256: '3d541976f665e85926dbf3f3302ab9e8f3746ddbf12ab821da18f871b1866c5c',
  },
  poster: {
    assetId: 'new-year-default-gift-wrapping-poster-964179e2cd040815',
    file: 'gift-wrapping.poster.964179e2cd040815.svg',
    bytes: 9297,
    sha256: '964179e2cd04081512181d81ae9fded957f265cff1e16e407a8a469896a4717a',
  },
} as const satisfies Record<string, PinnedPackAsset>;

/** The published `gift-wrapping` scene of `new-year-default@1.1.1`, with the given fallback. */
export const externalGiftWrappingScene = (
  fallback: CelebrationAnchorFallback = CelebrationAnchorFallback.StageAnchor,
): CelebrationSceneDescriptor => ({
  id: 'gift-wrapping',
  labelId: 'giftWrappingToastMessage',
  renderer: CelebrationCapability.LottieLightSvgV1,
  requiredCapabilities: [
    CelebrationCapability.LottieLightSvgV1,
    CelebrationCapability.ComposerAnchorV1,
    CelebrationCapability.InteractionComposerOutlineV1,
    CelebrationCapability.StaticPosterV1,
  ],
  placement: {
    template: CelebrationPlacementTemplate.ComposerAnchorV1,
    anchor: CelebrationAnchor.Composer,
    anchorRect: { x: 340, y: 164, width: 520, height: 56 },
    edge: CelebrationAnchorEdge.Top,
    scale: { min: 0.6, max: 1 },
    fallback,
  },
  direction: CelebrationDirectionMode.Mirror,
  timing: {
    playbackDurationMs: 16000,
    loadTimeoutMs: 2000,
    readyTimeoutMs: 250,
    maxLifetimeMs: 18500,
  },
  posterAssetId: EXTERNAL_GIFT_WRAPPING_ASSETS.poster.assetId,
  posterDurationMs: 4000,
  variants: [
    {
      when: { layout: CelebrationLayout.Desktop },
      animationAssetId: EXTERNAL_GIFT_WRAPPING_ASSETS.desktop.assetId,
    },
    {
      when: { layout: CelebrationLayout.Mobile },
      animationAssetId: EXTERNAL_GIFT_WRAPPING_ASSETS.mobile.assetId,
      placement: {
        template: CelebrationPlacementTemplate.ComposerAnchorV1,
        anchor: CelebrationAnchor.Composer,
        anchorRect: { x: 210, y: 132, width: 300, height: 56 },
        edge: CelebrationAnchorEdge.Top,
        scale: { min: 0.77, max: 1 },
        fallback,
      },
    },
  ],
});
