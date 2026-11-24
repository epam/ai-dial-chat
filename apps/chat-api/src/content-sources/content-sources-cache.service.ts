import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { UpstreamError, UpstreamFailure } from './content-provider';
import { ContentSourcesRegistryService } from './content-sources-registry.service';
import { recordContentSourceStaleServed } from './content-sources-telemetry';

/** Injection token of the dedicated content-sources caches (see the module). */
export const CONTENT_SOURCES_CACHE = Symbol('CONTENT_SOURCES_CACHE');

/**
 * Two stores with different bounds. `Meta` holds small values (listings and
 * commit dates) and is sized by entry count; `Content` holds document and
 * asset bytes and is sized by entry count times a per-entry byte ceiling.
 * Keeping them apart stops a burst of bytes evicting metadata and vice versa.
 */
export enum ContentSourcesCacheStore {
  Meta = 'meta',
  Content = 'content',
}

export interface ContentSourcesCaches {
  readonly meta: Cache;
  readonly content: Cache;
}

/** An expired entry stays physically stored this many TTLs, for stale-if-error. */
export const STALE_RETENTION_FACTOR = 4;

interface CacheEntry<T> {
  readonly value: T;
  readonly storedAt: number;
}

export interface LoadOptions<T> {
  /** Configured source id; used for logging and the stale-served counter only. */
  readonly sourceId: string;
  readonly store: ContentSourcesCacheStore;
  /** Return false to skip storing a loaded value (for example a large asset). */
  readonly cacheable?: (value: T) => boolean;
}

/**
 * Cache for upstream content with single-flight and stale-if-error.
 *
 * Entries are fresh for `CONTENT_SOURCES_CACHE_TTL_MS` and kept
 * `STALE_RETENTION_FACTOR` times longer. Past freshness the next caller
 * refreshes; concurrent callers for the same key share that one refresh. If
 * the refresh fails, the stale value is served — except when the upstream
 * says the content is gone (404), which is an answer, not an outage.
 */
@Injectable()
export class ContentSourcesCacheService {
  private readonly logger = new Logger(ContentSourcesCacheService.name);
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    @Inject(CONTENT_SOURCES_CACHE)
    private readonly caches: ContentSourcesCaches,
    private readonly registry: ContentSourcesRegistryService,
  ) {}

  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    options: LoadOptions<T>,
  ): Promise<T> {
    const cache = this.caches[options.store];
    const entry = await cache.get<CacheEntry<T>>(key);
    if (entry && Date.now() - entry.storedAt < this.registry.cacheTtlMs) {
      return entry.value;
    }

    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const refresh = this.refresh(cache, key, loader, options, entry);
    this.inFlight.set(key, refresh);
    try {
      return await refresh;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async refresh<T>(
    cache: Cache,
    key: string,
    loader: () => Promise<T>,
    options: LoadOptions<T>,
    stale: CacheEntry<T> | undefined | null,
  ): Promise<T> {
    try {
      const value = await loader();
      if (options.cacheable?.(value) ?? true) {
        await cache.set(
          key,
          { value, storedAt: Date.now() } satisfies CacheEntry<T>,
          this.registry.cacheTtlMs * STALE_RETENTION_FACTOR,
        );
      }
      return value;
    } catch (error) {
      if (
        stale &&
        !(
          error instanceof UpstreamError &&
          error.failure === UpstreamFailure.NotFound
        )
      ) {
        this.logger.warn(
          `Serving stale content for source "${options.sourceId}" after a failed refresh`,
        );
        recordContentSourceStaleServed(options.sourceId);
        return stale.value;
      }
      throw error;
    }
  }
}

/** Runs `task` over `items` with at most `limit` in flight, keeping input order. */
export const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
};
