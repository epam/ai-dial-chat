import type { ScheduledTaskRunDto } from '@epam/chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listScheduledTaskRuns } from '../../server-api/scheduled-tasks.api';

/** Page size requested from the BFF on each fetch (initial page and every subsequent load-more page). */
const PAGE_SIZE = 20;

/**
 * Whether another page likely exists beyond the just-fetched one. Prefers the
 * server's own signal (`next`, or `count` compared against rows consumed so
 * far) when present. When the upstream response omits both — which happens
 * for some DIAL Scheduler deployments — falls back to "the page was full"
 * (`items.length === PAGE_SIZE`) as a heuristic, so pagination doesn't get
 * stuck forever after the first page; a subsequent short/empty page then
 * naturally clears it.
 */
const deriveHasMore = (
  itemsInPage: number,
  rowsConsumed: number,
  count: number | null | undefined,
  next: string | null | undefined,
): boolean => {
  if (next != null) return true;
  if (count != null) return rowsConsumed < count;
  return itemsInPage === PAGE_SIZE;
};

/** Result of {@link useScheduledTaskRuns}. */
export interface UseScheduledTaskRunsResult {
  /** Accumulated runs across all loaded pages, in server order (newest first). Empty until the first successful fetch resolves. */
  items: ScheduledTaskRunDto[];
  /** Whether the initial fetch (or a fetch triggered by `refetch`) is in flight. */
  isLoading: boolean;
  /** Whether a `loadMore` fetch is in flight. */
  isLoadingMore: boolean;
  /** Set when the most recent fetch failed; `null` otherwise. */
  error: Error | null;
  /** Whether another page exists beyond the currently loaded `items`. */
  hasMore: boolean;
  /** Fetches and appends the next page, when `hasMore` and no fetch is already in flight. */
  loadMore: () => void;
  /** Resets to page 0 and refetches. */
  refetch: () => void;
}

/**
 * Owns pagination for a single scheduled task's run history, fetched from
 * `GET /api/v1/scheduled-tasks/:scheduleId/runs`. Mirrors the shape of
 * `useScheduledTasks` for consistency. `loadMore()` appends the next page
 * (deduplicated by `id`) without reordering — server order is always
 * `created_at desc`.
 */
export const useScheduledTaskRuns = (
  scheduleId: string,
  enabled = true,
): UseScheduledTaskRunsResult => {
  const [items, setItems] = useState<ScheduledTaskRunDto[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  /*
   * The next offset to request from the server. Deliberately independent of
   * `items.length`: `items` is deduplicated by id before being stored, so its
   * length can fall behind how many rows the server has actually served
   * across all pages.
   */
  const nextOffsetRef = useRef(0);

  /*
   * Incremented whenever the main effect's deps change (`scheduleId` in
   * particular). A `loadMore` fetch captures the token in effect at call
   * time and checks it again on completion — if a `scheduleId` change ran
   * the main effect in between, the token no longer matches and the stale
   * `loadMore` result is discarded instead of being appended to the new
   * schedule's `items`. The `cancelled`/`controller` pattern the main effect
   * uses for its own cleanup can't reach into an in-flight `loadMore` call,
   * since that call's locals live outside the effect closure.
   */
  const requestTokenRef = useRef(0);

  useEffect(() => {
    const token = ++requestTokenRef.current;
    // Any loadMore started under the previous token is now stale: its
    // completion handlers will no-op, so isLoadingMore would otherwise be
    // stuck at `true` forever. Reset it unconditionally here.
    setIsLoadingMore(false);

    if (!enabled) {
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await listScheduledTaskRuns({
          scheduleId,
          limit: PAGE_SIZE,
          offset: 0,
          signal: controller.signal,
        });
        if (requestTokenRef.current !== token) return;
        setItems(response.items);
        setHasMore(
          deriveHasMore(
            response.items.length,
            response.items.length,
            response.count,
            response.next,
          ),
        );
        nextOffsetRef.current = response.items.length;
      } catch (err) {
        if (requestTokenRef.current !== token) return;
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to load scheduled task runs'),
        );
      } finally {
        if (requestTokenRef.current === token) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [enabled, scheduleId, resetToken]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || isLoadingMore || isLoading) {
      return;
    }

    const token = requestTokenRef.current;
    const controller = new AbortController();
    const offset = nextOffsetRef.current;

    const run = async () => {
      setIsLoadingMore(true);
      setError(null);
      try {
        const response = await listScheduledTaskRuns({
          scheduleId,
          limit: PAGE_SIZE,
          offset,
          signal: controller.signal,
        });
        if (requestTokenRef.current !== token) return;
        setItems((current) => {
          const existingIds = new Set(current.map((item) => item.id));
          const newItems = response.items.filter(
            (item) => !existingIds.has(item.id),
          );
          return [...current, ...newItems];
        });
        setHasMore(
          deriveHasMore(
            response.items.length,
            offset + response.items.length,
            response.count,
            response.next,
          ),
        );
        nextOffsetRef.current = offset + response.items.length;
      } catch (err) {
        if (requestTokenRef.current !== token) return;
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to load more scheduled task runs'),
        );
      } finally {
        if (requestTokenRef.current === token) {
          setIsLoadingMore(false);
        }
      }
    };

    run();
  }, [enabled, hasMore, isLoadingMore, isLoading, scheduleId]);

  const refetch = useCallback(() => {
    if (enabled) {
      setResetToken((token) => token + 1);
    }
  }, [enabled]);

  return {
    items,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
  };
};
