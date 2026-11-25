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
import { contentSourcesStaleServed } from '../content-sources-telemetry';

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

  it.each([
    ['a full upstream queue', UpstreamFailure.QueueFull],
    ['a queue wait timeout', UpstreamFailure.Unavailable],
  ])(
    'serves the retained stale value when the refresh is refused by %s',
    async (_, failure) => {
      const staleServed = vi.spyOn(contentSourcesStaleServed, 'add');
      const service = create();
      const loader = vi
        .fn()
        .mockResolvedValueOnce('v1')
        .mockRejectedValueOnce(new UpstreamError(failure, 'no slot'));
      await service.getOrLoad('k', loader, OPTIONS);
      vi.advanceTimersByTime(TTL + 1);

      expect(await service.getOrLoad('k', loader, OPTIONS)).toBe('v1');
      expect(staleServed).toHaveBeenCalledWith(1, {
        'dial.chat.content_sources.source': 's',
      });
      staleServed.mockRestore();
    },
  );

  describe('cancellation', () => {
    /** A loader that stays pending until its signal aborts or it is released. */
    const pendingLoader = () => {
      let release!: (value: string) => void;
      let loadSignal!: AbortSignal;
      const loader = vi.fn(
        (signal: AbortSignal) =>
          new Promise<string>((resolve, reject) => {
            loadSignal = signal;
            release = resolve;
            signal.addEventListener('abort', () =>
              reject(new UpstreamError(UpstreamFailure.Unavailable, 'aborted')),
            );
          }),
      );
      return {
        loader,
        release: (value: string) => release(value),
        signal: () => loadSignal,
      };
    };

    it('keeps a shared load running when one caller leaves', async () => {
      const service = create();
      const load = pendingLoader();
      const leaving = new AbortController();
      const first = service.getOrLoad('k', load.loader, {
        ...OPTIONS,
        signal: leaving.signal,
      });
      const second = service.getOrLoad('k', load.loader, {
        ...OPTIONS,
        signal: new AbortController().signal,
      });
      await vi.waitFor(() => expect(load.loader).toHaveBeenCalledOnce());

      leaving.abort();
      await expect(first).rejects.toMatchObject({ name: 'AbortError' });
      expect(load.signal().aborted).toBe(false);

      load.release('shared');
      expect(await second).toBe('shared');
      expect(load.loader).toHaveBeenCalledOnce();
    });

    it('aborts the load when the last caller leaves and does not cache it', async () => {
      const staleServed = vi.spyOn(contentSourcesStaleServed, 'add');
      const service = create();
      const fresh = vi.fn().mockResolvedValueOnce('v1');
      await service.getOrLoad('k', fresh, OPTIONS);
      vi.advanceTimersByTime(TTL + 1);

      const load = pendingLoader();
      const callers = [new AbortController(), new AbortController()];
      const calls = callers.map((controller) =>
        service.getOrLoad('k', load.loader, {
          ...OPTIONS,
          signal: controller.signal,
        }),
      );
      await vi.waitFor(() => expect(load.loader).toHaveBeenCalledOnce());
      callers.forEach((controller) => controller.abort());

      for (const call of calls) {
        await expect(call).rejects.toMatchObject({ name: 'AbortError' });
      }
      expect(load.signal().aborted).toBe(true);
      /* The aborted refresh was neither served stale nor counted. */
      expect(staleServed).not.toHaveBeenCalled();

      const next = vi.fn().mockResolvedValue('v2');
      expect(await service.getOrLoad('k', next, OPTIONS)).toBe('v2');
      expect(next).toHaveBeenCalledOnce();
      staleServed.mockRestore();
    });

    it('does not store a value that arrives after every caller left', async () => {
      const service = create();
      let release!: (value: string) => void;
      const loader = vi.fn(
        () => new Promise<string>((resolve) => (release = resolve)),
      );
      const caller = new AbortController();
      const call = service.getOrLoad('k', loader, {
        ...OPTIONS,
        signal: caller.signal,
      });
      await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
      caller.abort();
      await expect(call).rejects.toMatchObject({ name: 'AbortError' });
      release('late');
      await Promise.resolve();

      const next = vi.fn().mockResolvedValue('reloaded');
      expect(await service.getOrLoad('k', next, OPTIONS)).toBe('reloaded');
    });

    it('starts a new load for a caller arriving after a cancellation', async () => {
      const service = create();
      const load = pendingLoader();
      const caller = new AbortController();
      const cancelled = service.getOrLoad('k', load.loader, {
        ...OPTIONS,
        signal: caller.signal,
      });
      await vi.waitFor(() => expect(load.loader).toHaveBeenCalledOnce());
      caller.abort();
      await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });

      const next = vi.fn().mockResolvedValue('new');
      expect(await service.getOrLoad('k', next, OPTIONS)).toBe('new');
      expect(next).toHaveBeenCalledOnce();
    });

    it('refuses an already aborted caller without loading', async () => {
      const service = create();
      const loader = vi.fn();
      await expect(
        service.getOrLoad('k', loader, {
          ...OPTIONS,
          signal: AbortSignal.abort(),
        }),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(loader).not.toHaveBeenCalled();
    });
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
