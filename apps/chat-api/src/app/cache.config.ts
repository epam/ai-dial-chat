import { createKeyv, KeyvCacheableMemory } from '@cacheable/memory';
import type { CacheManagerOptions } from '@nestjs/cache-manager';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const CACHE_CLEANUP_INTERVAL_MS = 60 * 1000;

export const createAppCacheOptions = (): CacheManagerOptions => {
  /*
   * cache-manager's default Keyv Map ignores `max` and only removes expired
   * values on access. Bound the store itself and sweep unused expired keys.
   * Keep reference semantics, including Buffer values cached for theme icons.
   */
  const keyv = createKeyv({
    lruSize: CACHE_MAX_ENTRIES,
    checkInterval: CACHE_CLEANUP_INTERVAL_MS,
    useClone: false,
  });
  const memory = (keyv.store as KeyvCacheableMemory).store;

  /* The adapter has no disconnect hook of its own to release the sweep timer. */
  keyv.on('disconnect', () => {
    memory.stopIntervalCheck();
    memory.clear();
  });

  return { ttl: CACHE_TTL_MS, stores: [keyv] };
};
