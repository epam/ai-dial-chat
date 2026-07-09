import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withCachedDialRequest } from '../cached-dial-request.helper';

function makeCacheManager(initial?: Record<string, unknown>) {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}));
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };
}

describe('withCachedDialRequest', () => {
  const logger = new Logger('test');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached value without calling fetch on cache hit', async () => {
    const cacheManager = makeCacheManager({ key1: { data: 'cached' } });
    const fetch = vi.fn().mockResolvedValue({ data: 'fresh' });

    const result = await withCachedDialRequest({
      cacheManager: cacheManager as never,
      cacheKey: 'key1',
      context: 'test request',
      logger,
      fetch,
    });

    expect(result).toEqual({ data: 'cached' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls fetch and caches the result with the default TTL on cache miss', async () => {
    const cacheManager = makeCacheManager();
    const fetch = vi.fn().mockResolvedValue({ data: 'fresh' });

    const result = await withCachedDialRequest({
      cacheManager: cacheManager as never,
      cacheKey: 'key1',
      context: 'test request',
      logger,
      fetch,
    });

    expect(result).toEqual({ data: 'fresh' });
    expect(cacheManager.set).toHaveBeenCalledWith(
      'key1',
      { data: 'fresh' },
      30_000,
    );
  });

  it('uses the provided TTL when set', async () => {
    const cacheManager = makeCacheManager();
    const fetch = vi.fn().mockResolvedValue({ data: 'fresh' });

    await withCachedDialRequest({
      cacheManager: cacheManager as never,
      cacheKey: 'key1',
      ttlMs: 60_000,
      context: 'test request',
      logger,
      fetch,
    });

    expect(cacheManager.set).toHaveBeenCalledWith(
      'key1',
      { data: 'fresh' },
      60_000,
    );
  });

  it('applies transform before caching on cache miss', async () => {
    const cacheManager = makeCacheManager();
    const fetch = vi.fn().mockResolvedValue({ data: 'fresh' });

    const result = await withCachedDialRequest({
      cacheManager: cacheManager as never,
      cacheKey: 'key1',
      context: 'test request',
      logger,
      fetch,
      transform: (data) => ({ data: `${(data as { data: string }).data}!` }),
    });

    expect(result).toEqual({ data: 'fresh!' });
    expect(cacheManager.set).toHaveBeenCalledWith(
      'key1',
      { data: 'fresh!' },
      30_000,
    );
  });

  it('propagates a thrown Nest exception from fetch without caching', async () => {
    const cacheManager = makeCacheManager();
    const fetch = vi
      .fn()
      .mockRejectedValue(new ServiceUnavailableException('down'));

    await expect(
      withCachedDialRequest({
        cacheManager: cacheManager as never,
        cacheKey: 'key1',
        context: 'test request',
        logger,
        fetch,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('maps an unexpected error via handleDialFetchError', async () => {
    const cacheManager = makeCacheManager();
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      withCachedDialRequest({
        cacheManager: cacheManager as never,
        cacheKey: 'key1',
        context: 'test request',
        logger,
        fetch,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
