import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  abortReason,
  UpstreamError,
  UpstreamFailure,
} from './content-provider';
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
  /**
   * This caller's ownership of the load: aborting it rejects only this call,
   * and cancels the shared load once no caller waits for it any more.
   */
  readonly signal?: AbortSignal;
}

/**
 * One coalesced load. It owns its abort controller, so one caller leaving
 * cannot abort work another caller still needs; the last one leaving does.
 */
interface Flight<T> {
  promise: Promise<T>;
  readonly controller: AbortController;
  consumers: number;
}

/**
 * Cache for upstream content with single-flight and stale-if-error.
 *
 * Entries are fresh for `CONTENT_SOURCES_CACHE_TTL_MS` and kept
 * `STALE_RETENTION_FACTOR` times longer. Past freshness the next caller
 * refreshes; concurrent callers for the same key share that one refresh. If
 * the refresh fails, the stale value is served — except when the upstream
 * says the content is gone (404), which is an answer, not an outage.
 *
 * Single-flight is consumer-owned, as in `ConversationTitleCacheService`: a
 * load is cancelled (its queued upstream call leaves the queue, a running one
 * is aborted) when every caller waiting for it has aborted. A cancelled load
 * is never stored, never served stale and never counted as stale-served.
 */
@Injectable()
export class ContentSourcesCacheService {
  private readonly logger = new Logger(ContentSourcesCacheService.name);
  private readonly inFlight = new Map<string, Flight<unknown>>();

  constructor(
    @Inject(CONTENT_SOURCES_CACHE)
    private readonly caches: ContentSourcesCaches,
    private readonly registry: ContentSourcesRegistryService,
  ) {}

  /**
   * Returns the fresh cached value, or joins / starts the one load for `key`.
   * `loader` runs only in the caller that starts the load and receives the
   * load's own signal, which aborts once no caller waits for it.
   */
  async getOrLoad<T>(
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    options: LoadOptions<T>,
  ): Promise<T> {
    if (options.signal?.aborted) throw abortReason(options.signal);
    const cache = this.caches[options.store];
    const entry = await cache.get<CacheEntry<T>>(key);
    if (entry && Date.now() - entry.storedAt < this.registry.cacheTtlMs) {
      return entry.value;
    }

    let flight = this.inFlight.get(key) as Flight<T> | undefined;
    if (!flight || flight.controller.signal.aborted) {
      flight = this.start(cache, key, loader, options, entry);
    }
    return this.consume(key, flight, options.signal);
  }

  private start<T>(
    cache: Cache,
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    options: LoadOptions<T>,
    stale: CacheEntry<T> | undefined | null,
  ): Flight<T> {
    const controller = new AbortController();
    const flight: Flight<T> = {
      controller,
      consumers: 0,
      promise: Promise.resolve() as Promise<T>,
    };
    flight.promise = (async () => {
      try {
        return await this.refresh(
          cache,
          key,
          loader,
          options,
          stale,
          controller.signal,
        );
      } finally {
        if (this.inFlight.get(key) === flight) this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, flight);
    return flight;
  }

  private consume<T>(
    key: string,
    flight: Flight<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    flight.consumers++;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        reject(abortReason(signal as AbortSignal));
        if (--flight.consumers === 0) {
          flight.controller.abort();
          /* A later caller starts a new load instead of joining a cancelled one. */
          if (this.inFlight.get(key) === flight) this.inFlight.delete(key);
        }
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      flight.promise.then(
        (value) => {
          signal?.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal?.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }

  private async refresh<T>(
    cache: Cache,
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    options: LoadOptions<T>,
    stale: CacheEntry<T> | undefined | null,
    signal: AbortSignal,
  ): Promise<T> {
    try {
      const value = await loader(signal);
      if (signal.aborted) throw abortReason(signal);
      if (options.cacheable?.(value) ?? true) {
        await cache.set(
          key,
          { value, storedAt: Date.now() } satisfies CacheEntry<T>,
          this.registry.cacheTtlMs * STALE_RETENTION_FACTOR,
        );
      }
      return value;
    } catch (error) {
      /* Nobody waits for a cancelled load: no stale fallback, no counter. */
      if (signal.aborted) throw error;
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
