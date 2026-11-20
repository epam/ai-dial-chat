import type { CelebrationAssetLoaders } from '../models/celebration-pack';
import { EXTERNAL_GIFT_WRAPPING_ASSETS } from '../test-utils/external-gift-wrapping';
import { CAT_BORROW_ASSET_IDS, CatAsset } from './cat-borrow-scenes';
import anchoredAnimation from './fixtures/anchored-scene.lottie.json';
import catBorrowFull from './fixtures/cat-borrow-full.lottie.json';
import catBorrowSpike from './fixtures/cat-borrow-spike.lottie.json';
import giftWrappingDesktop from './fixtures/external/gift-wrapping.desktop.28260bbcf8f593a6.json';
import giftWrappingMobile from './fixtures/external/gift-wrapping.mobile.3d541976f665e859.json';
import giftWrappingPosterUrl from './fixtures/external/gift-wrapping.poster.964179e2cd040815.svg';
import posterUrl from './fixtures/pack-poster.svg';
import animation from './fixtures/pack-scene.lottie.json';
import triggerUrl from './fixtures/pack-trigger.svg';

/** How the story's animation loader behaves. */
export enum PackStoryLoader {
  /** Resolves after a short simulated round trip. */
  Ready = 'ready',
  /** Resolves after the scene's load deadline, so the poster shows. */
  Slow = 'slow',
  /** Rejects at once, so the poster shows. */
  Broken = 'broken',
  /** Resolves late and ignores the abort signal, like a stale response. */
  IgnoresAbort = 'ignores-abort',
}

const DELAY_MS: Record<PackStoryLoader, number> = {
  [PackStoryLoader.Ready]: 150,
  [PackStoryLoader.Slow]: 4000,
  [PackStoryLoader.Broken]: 0,
  [PackStoryLoader.IgnoresAbort]: 1000,
};

const ANIMATIONS: Readonly<Record<string, unknown>> = {
  fixture: animation,
  'anchored-fixture': anchoredAnimation,
  [CAT_BORROW_ASSET_IDS[CatAsset.Spike]]: catBorrowSpike,
  [CAT_BORROW_ASSET_IDS[CatAsset.Full]]: catBorrowFull,
  [EXTERNAL_GIFT_WRAPPING_ASSETS.desktop.assetId]: giftWrappingDesktop,
  [EXTERNAL_GIFT_WRAPPING_ASSETS.mobile.assetId]: giftWrappingMobile,
};

const IMAGES: Readonly<Record<string, string>> = {
  'fixture-poster': posterUrl,
  'fixture-trigger': triggerUrl,
  [EXTERNAL_GIFT_WRAPPING_ASSETS.poster.assetId]: giftWrappingPosterUrl,
};

/** Story loaders plus a check that playback never changed the cached clips. */
export interface StoryPackLoaders extends CelebrationAssetLoaders {
  /** Whether every cached clip still equals the fixture it was cloned from. */
  isCachePristine: () => boolean;
}

/** Story loaders that serve the local fixture clip and keep it for the page, as a host would. */
export const createStoryPackLoaders = (
  mode = PackStoryLoader.Ready,
  onRequest?: () => void,
): StoryPackLoaders => {
  const cache = new Map<string, unknown>();
  return {
    isCachePristine: () =>
      [...cache].every(
        ([assetId, data]) =>
          JSON.stringify(data) ===
          JSON.stringify(ANIMATIONS[assetId] ?? animation),
      ),
    loadAnimationData: (assetId, signal) => {
      if (cache.has(assetId)) return Promise.resolve(cache.get(assetId));
      onRequest?.();
      return new Promise((resolve, reject) => {
        if (signal.aborted || mode === PackStoryLoader.Broken) {
          reject(new Error('Fixture unavailable'));
          return;
        }
        /* The delay stands in for the network round trip. */
        const timer = setTimeout(() => {
          const data = structuredClone(ANIMATIONS[assetId] ?? animation);
          cache.set(assetId, data);
          resolve(data);
        }, DELAY_MS[mode]);
        if (mode === PackStoryLoader.IgnoresAbort) return;
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Aborted'));
        });
      });
    },
    resolveImageUrl: (assetId) => IMAGES[assetId],
  };
};
