import type { ScheduledTaskRunDto } from '@epam/chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listScheduledTaskRuns } from '../../server-api/scheduled-tasks.api';

/** Page size requested from the BFF on each fetch (initial page and every subsequent load-more page). */
const PAGE_SIZE = 20;

/** Result of {@link useScheduledTaskRuns}. */
interface UseScheduledTaskRunsResult {
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

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const cancelled = { value: false };

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
        if (!cancelled.value) {
          setItems(response.items);
          setHasMore(
            response.next != null ||
              (response.count != null &&
                response.items.length < response.count),
          );
          nextOffsetRef.current = response.items.length;
        }
      } catch (err) {
        if (!cancelled.value) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to load scheduled task runs'),
          );
        }
      } finally {
        if (!cancelled.value) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled.value = true;
      controller.abort();
    };
  }, [enabled, scheduleId, resetToken]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || isLoadingMore || isLoading) {
      return;
    }

    const controller = new AbortController();
    const cancelled = { value: false };
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
        if (!cancelled.value) {
          setItems((current) => {
            const existingIds = new Set(current.map((item) => item.id));
            const newItems = response.items.filter(
              (item) => !existingIds.has(item.id),
            );
            return [...current, ...newItems];
          });
          setHasMore(
            response.next != null ||
              (response.count != null &&
                offset + response.items.length < response.count),
          );
          nextOffsetRef.current = offset + response.items.length;
        }
      } catch (err) {
        if (!cancelled.value) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to load more scheduled task runs'),
          );
        }
      } finally {
        if (!cancelled.value) {
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
