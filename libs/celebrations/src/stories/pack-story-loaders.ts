import type { CelebrationAssetLoaders } from '../models/celebration-pack';
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

const IMAGES: Readonly<Record<string, string>> = {
  'fixture-poster': posterUrl,
  'fixture-trigger': triggerUrl,
};

/** Story loaders that serve the local fixture clip and keep it for the page, as a host would. */
export const createStoryPackLoaders = (
  mode = PackStoryLoader.Ready,
  onRequest?: () => void,
): CelebrationAssetLoaders => {
  const cache = new Map<string, unknown>();
  return {
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
          const data = structuredClone(animation);
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
