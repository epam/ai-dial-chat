import { createCache } from 'cache-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpstreamError, UpstreamFailure } from '../content-provider';
import {
  ContentSourcesCaches,
  ContentSourcesCacheService,
  ContentSourcesCacheStore,
  mapWithConcurrency,
} from '../content-sources-cache.service';
import { ContentSourcesRegistryService } from '../content-sources-registry.service';

const TTL = 1000;

/* cache-manager ships separate CJS and ESM typings; the cast bridges them. */
const createCaches = () =>
  ({
    meta: createCache(),
    content: createCache(),
  }) as unknown as ContentSourcesCaches;

const create = () =>
  new ContentSourcesCacheService(createCaches(), {
    cacheTtlMs: TTL,
  } as ContentSourcesRegistryService);
const OPTIONS = {
  sourceId: 's',
  store: ContentSourcesCacheStore.Meta,
} as const;

describe('ContentSourcesCacheService', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('serves a fresh entry without calling the loader again', async () => {
    const service = create();
    const loader = vi.fn().mockResolvedValue('v1');
    expect(await service.getOrLoad('k', loader, OPTIONS)).toBe('v1');
    expect(await service.getOrLoad('k', loader, OPTIONS)).toBe('v1');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('shares one upstream call between concurrent requests', async () => {
    const service = create();
    let release!: (value: string) => void;
    const loader = vi.fn(
      () => new Promise<string>((resolve) => (release = resolve)),
    );
    const calls = [1, 2, 3, 4, 5].map(() =>
      service.getOrLoad('k', loader, OPTIONS),
    );
    await vi.waitFor(() => expect(loader).toHaveBeenCalled());
    release('shared');
    expect(await Promise.all(calls)).toEqual(Array(5).fill('shared'));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('refreshes after the TTL', async () => {
    const service = create();
    const loader = vi
      .fn()
      .mockResolvedValueOnce('v1')
      .mockResolvedValueOnce('v2');
    await service.getOrLoad('k', loader, OPTIONS);
    vi.advanceTimersByTime(TTL + 1);
    expect(await service.getOrLoad('k', loader, OPTIONS)).toBe('v2');
  });

  it('serves the stale value when the refresh fails', async () => {
    const service = create();
    const loader = vi
      .fn()
      .mockResolvedValueOnce('v1')
      .mockRejectedValueOnce(
        new UpstreamError(UpstreamFailure.Unavailable, 'down'),
      );
    await service.getOrLoad('k', loader, OPTIONS);
    vi.advanceTimersByTime(TTL + 1);
    expect(await service.getOrLoad('k', loader, OPTIONS)).toBe('v1');
  });

  it('does not serve stale content the upstream says is gone', async () => {
    const service = create();
    const loader = vi
      .fn()
      .mockResolvedValueOnce('v1')
      .mockRejectedValueOnce(
        new UpstreamError(UpstreamFailure.NotFound, 'gone'),
      );
    await service.getOrLoad('k', loader, OPTIONS);
    vi.advanceTimersByTime(TTL + 1);
    await expect(service.getOrLoad('k', loader, OPTIONS)).rejects.toMatchObject(
      { failure: UpstreamFailure.NotFound },
    );
  });

  it('propagates a failure when nothing is cached', async () => {
    const service = create();
    const error = new UpstreamError(UpstreamFailure.Unavailable, 'down');
    await expect(
      service.getOrLoad('k', () => Promise.reject(error), OPTIONS),
    ).rejects.toBe(error);
  });

  it('does not keep a failed flight, so the next call retries', async () => {
    const service = create();
    const loader = vi
      .fn()
      .mockRejectedValueOnce(
        new UpstreamError(UpstreamFailure.Unavailable, 'x'),
      )
      .mockResolvedValueOnce('ok');
    await expect(service.getOrLoad('k', loader, OPTIONS)).rejects.toBeDefined();
    expect(await service.getOrLoad('k', loader, OPTIONS)).toBe('ok');
  });

  it('keeps the two stores independent', async () => {
    const service = create();
    const loader = vi.fn().mockResolvedValue('v');
    await service.getOrLoad('k', loader, OPTIONS);
    await service.getOrLoad('k', loader, {
      ...OPTIONS,
      store: ContentSourcesCacheStore.Content,
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('skips storing values the caller marks uncacheable', async () => {
    const service = create();
    const loader = vi.fn().mockResolvedValue('big');
    const options = { ...OPTIONS, cacheable: () => false };
    await service.getOrLoad('k', loader, options);
    await service.getOrLoad('k', loader, options);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('mapWithConcurrency', () => {
  it('never exceeds the limit and keeps input order', async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      4,
      async (n) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return n * 2;
      },
    );
    expect(peak).toBeLessThanOrEqual(4);
    expect(result).toEqual(Array.from({ length: 12 }, (_, i) => i * 2));
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
