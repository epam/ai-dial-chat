import type { CelebrationAssetLoaders } from '../models/celebration-pack';
import posterUrl from './fixtures/pack-poster.svg';
import animation from './fixtures/pack-scene.lottie.json';
import triggerUrl from './fixtures/pack-trigger.svg';

const IMAGES: Readonly<Record<string, string>> = {
  'fixture-poster': posterUrl,
  'fixture-trigger': triggerUrl,
};

/** Story loaders that serve the local fixture clip, or fail to show the poster. */
export const createStoryPackLoaders = (
  shouldFail = false,
): CelebrationAssetLoaders => ({
  loadAnimationData: (_assetId, signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted || shouldFail) {
        reject(new Error('Fixture unavailable'));
        return;
      }
      /* A short delay stands in for the network round trip. */
      const timer = setTimeout(() => resolve(structuredClone(animation)), 150);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      });
    }),
  resolveImageUrl: (assetId) => IMAGES[assetId],
});
