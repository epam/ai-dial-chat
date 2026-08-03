import { ScheduledTasksSortKey } from '@epam/ai-dial-scheduled-tasks';
import type { ScheduledTaskDto } from '@epam/chat-api-client';
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
  /** Currently selected sort key. Purely a client-side concern — changing it never triggers a fetch. */
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

/**
 * Owns pagination and server-driven search for the Scheduled Tasks list.
 * `searchQuery` changes (debounced) and `refetch()` reset `items` and fetch
 * page 0; `loadMore()` appends the next page. `sortKey` is tracked here for
 * convenience but never sent to the server — the upstream DIAL Scheduler has
 * no sort capability, so sorting stays a client-side concern over whatever
 * has been loaded so far.
 */
export const useScheduledTasks = (enabled = true): UseScheduledTasksResult => {
  const [items, setItems] = useState<ScheduledTaskDto[]>([]);
  const [searchQuery, setSearchQueryState] = useState('');
  const [sortKey, setSortKey] = useState<ScheduledTasksSortKey>(
    ScheduledTasksSortKey.FirstToRun,
  );
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const debouncedSearchRef = useRef(searchQuery);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    debouncedSearchRef.current = searchQuery;
    const timeoutId = setTimeout(() => {
      if (debouncedSearchRef.current === searchQuery) {
        setDebouncedSearchQuery(searchQuery);
      }
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
          signal: controller.signal,
        });
        if (!cancelled.value) {
          setItems(response.items);
          setHasMore(response.next != null);
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
    };
  }, [enabled, debouncedSearchQuery, resetToken]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || isLoadingMore || isLoading) {
      return;
    }

    const controller = new AbortController();
    const offset = items.length;

    setIsLoadingMore(true);
    setError(null);

    listScheduledTasks({
      limit: PAGE_SIZE,
      offset,
      search: debouncedSearchQuery,
      signal: controller.signal,
    })
      .then((response) => {
        setItems((current) => {
          const existingIds = new Set(current.map((item) => item.id));
          const newItems = response.items.filter(
            (item) => !existingIds.has(item.id),
          );
          return [...current, ...newItems];
        });
        setHasMore(response.next != null);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to load more scheduled tasks'),
        );
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  }, [
    enabled,
    hasMore,
    isLoadingMore,
    isLoading,
    items.length,
    debouncedSearchQuery,
  ]);

  const refetch = useCallback(() => {
    if (enabled) {
      setResetToken((token) => token + 1);
    }
  }, [enabled]);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

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
