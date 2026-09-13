import { KeyvCacheableMemory } from '@cacheable/memory';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppCacheOptions } from '../cache.config';

/*
 * Nest loads Keyv through CommonJS and checks stores with instanceof. Use the
 * adapter's real CommonJS entry, as the backend bundle does, so Vitest does
 * not introduce a second, ESM Keyv class and make Nest wrap it as an adapter.
 */
vi.mock('@cacheable/memory', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@cacheable/memory');
});

describe('application cache', () => {
  let module: TestingModule;
  let cache: Cache;

  beforeEach(async () => {
    vi.useFakeTimers();
    module = await Test.createTestingModule({
      imports: [
        CacheModule.registerAsync({ useFactory: createAppCacheOptions }),
      ],
    }).compile();
    cache = module.get<Cache>(CACHE_MANAGER);
  });

  afterEach(async () => {
    await module?.close();
    vi.useRealTimers();
  });

  const getStoredEntryCount = () =>
    (cache.stores[0].store as KeyvCacheableMemory).store.size;

  it('evicts the least recently used entry when more than 100 keys are cached', async () => {
    for (let index = 0; index < 100; index++) {
      await cache.set(`models:user-${index}`, { index });
    }
    await cache.get('models:user-0');
    await cache.set('models:user-100', { index: 100 });

    expect(await cache.get('models:user-1')).toBeUndefined();
    expect(await cache.get('models:user-0')).toEqual({ index: 0 });
    expect(await cache.get('models:user-100')).toEqual({ index: 100 });
    expect(getStoredEntryCount()).toBe(100);
  });

  it('physically removes expired keys without reading them again', async () => {
    await cache.set('models:departed-user', { data: ['model'] }, 30_000);
    await cache.set('models:active-user', { data: ['model'] }, 120_000);

    await vi.advanceTimersByTimeAsync(60_001);

    expect(getStoredEntryCount()).toBe(1);
    expect(await cache.get('models:active-user')).toEqual({ data: ['model'] });
  });

  it('keeps the five-minute default TTL and per-entry TTL overrides', async () => {
    await cache.set('themes:config', { theme: 'dark' });
    await cache.set('models:list:user', { data: [] }, 30_000);
    await cache.set('scheduled-tasks:list-epoch:user', 1, 600_000);

    await vi.advanceTimersByTimeAsync(30_001);
    expect(await cache.get('models:list:user')).toBeUndefined();
    expect(await cache.get('themes:config')).toEqual({ theme: 'dark' });

    await vi.advanceTimersByTimeAsync(270_000);
    expect(await cache.get('themes:config')).toBeUndefined();
    expect(await cache.get('scheduled-tasks:list-epoch:user')).toBe(1);
  });

  it('preserves zero TTL as no expiration', async () => {
    await cache.set('persistent', { enabled: true }, 0);

    await vi.advanceTimersByTimeAsync(600_001);

    expect(getStoredEntryCount()).toBe(1);
    expect(await cache.get('persistent')).toEqual({ enabled: true });
  });

  it('preserves binary theme icons and object references without cloning', async () => {
    const icon = Buffer.from([0, 127, 255]);
    const config = { theme: 'dark' };
    await cache.set('themes:icon:logo.png', icon);
    await cache.set('themes:config', config);

    expect(await cache.get('themes:icon:logo.png')).toBe(icon);
    expect(await cache.get('themes:config')).toBe(config);
  });

  it('does not accumulate entries across batches of unique expired keys', async () => {
    for (let batch = 0; batch < 3; batch++) {
      for (let index = 0; index < 1000; index++) {
        await cache.set(`models:user-${batch}-${index}`, { index }, 20);
      }
      expect(getStoredEntryCount()).toBe(100);

      await vi.advanceTimersByTimeAsync(60_001);

      expect(getStoredEntryCount()).toBe(0);
    }
  });

  it('supports explicit invalidation and clearing', async () => {
    await cache.set('models:single:user:model', { id: 'model' });
    await cache.set('themes:config', { theme: 'dark' });

    await cache.del('models:single:user:model');
    expect(await cache.get('models:single:user:model')).toBeUndefined();
    expect(getStoredEntryCount()).toBe(1);

    await cache.clear();
    expect(getStoredEntryCount()).toBe(0);
  });

  it('releases its timer and cached values when the Nest module closes', async () => {
    await cache.set('models:user', { data: ['model'] });
    expect(vi.getTimerCount()).toBe(1);

    await module.close();

    expect(vi.getTimerCount()).toBe(0);
    expect(getStoredEntryCount()).toBe(0);
  });
});
