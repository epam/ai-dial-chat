import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import { ScheduledTasksSortKey } from '@epam/ai-dial-scheduled-tasks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listScheduledTasks } from '../../server-api/scheduled-tasks.api';

/** Page size requested from the BFF on each fetch (initial page and every subsequent load-more page). */
const PAGE_SIZE = 20;

/** Debounce delay before a `searchQuery` change triggers a server refetch, to avoid a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

/** Result of {@link useScheduledTasks}. */
interface UseScheduledTasksResult {
  /** Accumulated scheduled tasks across all loaded pages. Empty until the first successful fetch resolves. */
  items: ScheduledTaskDto[];
  /** Current search query. Changing it (debounced) resets `items` and refetches page 0 with the new value. */
  searchQuery: string;
  /** Updates `searchQuery`. */
  setSearchQuery: (query: string) => void;
  /** Currently selected sort key. Changing it immediately resets `items` and refetches page 0 with the new value. */
  sortKey: ScheduledTasksSortKey;
  /** Updates `sortKey`. */
  setSortKey: (key: ScheduledTasksSortKey) => void;
  /** Whether the initial fetch (or a fetch triggered by a `searchQuery` change or `refetch`) is in flight. */
  isLoading: boolean;
  /** Whether a `loadMore` fetch is in flight. */
  isLoadingMore: boolean;
  /** Set when the most recent fetch failed; `null` otherwise. */
  error: Error | null;
  /** Whether another page exists beyond the currently loaded `items`. */
  hasMore: boolean;
  /** Fetches and appends the next page, when `hasMore` and no fetch is already in flight. */
  loadMore: () => void;
  /** Resets to page 0 with the current `searchQuery`, e.g. after returning from the create flow or on retry. */
  refetch: () => void;
}

/** Tracks the cancellation state of an in-flight `loadMore` fetch so a superseded search/reset can abort it. */
interface LoadMoreCancellation {
  abort: () => void;
  cancelled: { value: boolean };
}

/**
 * Owns pagination, server-driven search, and server-driven sort for the
 * Scheduled Tasks list. `searchQuery` changes (debounced), `sortKey` changes
 * (immediate), and `refetch()` all reset `items` and fetch page 0 with the
 * current `search`/`sort`; `loadMore()` appends the next page using the same
 * `sort` so appended pages stay in server order.
 */
export const useScheduledTasks = (enabled = true): UseScheduledTasksResult => {
  const [items, setItems] = useState<ScheduledTaskDto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<ScheduledTasksSortKey>(
    ScheduledTasksSortKey.FirstToRun,
  );
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  /*
   * The next offset to request from the server. Deliberately independent of
   * `items.length`: `items` is deduplicated by id before being stored, so its
   * length can fall behind how many rows the server has actually served
   * across all pages (e.g. if a page boundary happens to repeat a row).
   * Using `items.length` as the offset would then re-request an
   * already-served window instead of the next one.
   */
  const nextOffsetRef = useRef(0);

  /* Lets the main load effect cancel a `loadMore` fetch that's still in
   * flight when a new search/reset supersedes it, so its result can't be
   * appended onto an unrelated, newer `items` array. */
  const loadMoreCancelRef = useRef<LoadMoreCancellation | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

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
        const response = await listScheduledTasks({
          limit: PAGE_SIZE,
          offset: 0,
          search: debouncedSearchQuery,
          sort: sortKey,
          signal: controller.signal,
        });
        if (!cancelled.value) {
          setItems(response.items);
          setHasMore(response.next != null);
          nextOffsetRef.current = response.items.length;
        }
      } catch (err) {
        if (!cancelled.value) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to load scheduled tasks'),
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
      loadMoreCancelRef.current?.abort();
      if (loadMoreCancelRef.current) {
        loadMoreCancelRef.current.cancelled.value = true;
      }
      loadMoreCancelRef.current = null;
    };
  }, [enabled, debouncedSearchQuery, sortKey, resetToken]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || isLoadingMore || isLoading) {
      return;
    }

    const controller = new AbortController();
    const cancelled = { value: false };
    loadMoreCancelRef.current = { abort: () => controller.abort(), cancelled };
    const offset = nextOffsetRef.current;

    const run = async () => {
      setIsLoadingMore(true);
      setError(null);
      try {
        const response = await listScheduledTasks({
          limit: PAGE_SIZE,
          offset,
          search: debouncedSearchQuery,
          sort: sortKey,
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
          setHasMore(response.next != null);
          nextOffsetRef.current = offset + response.items.length;
        }
      } catch (err) {
        if (!cancelled.value) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to load more scheduled tasks'),
          );
        }
      } finally {
        if (!cancelled.value) {
          setIsLoadingMore(false);
        }
      }
    };

    run();
  }, [
    enabled,
    hasMore,
    isLoadingMore,
    isLoading,
    debouncedSearchQuery,
    sortKey,
  ]);

  const refetch = useCallback(() => {
    if (enabled) {
      setResetToken((token) => token + 1);
    }
  }, [enabled]);

  return {
    items,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
  };
};
