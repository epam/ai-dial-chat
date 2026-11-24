import type { CelebrationSceneDescriptor } from '../models/celebration-pack';
import { CelebrationLayout } from '../types/celebration-pack';
import { santaHistoryDeliveryScene } from './santa-history-delivery';

/** Full unpublished authored story, independently pinned from the representative clip. */
export const SANTA_HISTORY_FULL_ASSETS = {
  desktop: {
    assetId: 'santa-history-full-desktop',
    file: 'santa-history-delivery.full.desktop.0166262c3d3c46ae.json',
    bytes: 280513,
    sha256: '0166262c3d3c46ae2c11fcc387169bcb3e77d8031a45303099f4643f29170879',
  },
  mobile: {
    assetId: 'santa-history-full-mobile',
    file: 'santa-history-delivery.full.mobile.e44dde821ea6b972.json',
    bytes: 274037,
    sha256: 'e44dde821ea6b9722ed1aa0b911de524a598418c6dc1f9e00a410be1750f3ef4',
  },
} as const;

/** Same shared adapter and poster, with the full native 27-second story. */
export const santaHistoryFullScene = (): CelebrationSceneDescriptor => ({
  ...santaHistoryDeliveryScene(),
  timing: {
    playbackDurationMs: 27000,
    loadTimeoutMs: 2000,
    readyTimeoutMs: 250,
    maxLifetimeMs: 29500,
  },
  variants: [
    {
      when: { layout: CelebrationLayout.Desktop },
      animationAssetId: SANTA_HISTORY_FULL_ASSETS.desktop.assetId,
    },
    {
      when: { layout: CelebrationLayout.Mobile },
      animationAssetId: SANTA_HISTORY_FULL_ASSETS.mobile.assetId,
    },
  ],
});
