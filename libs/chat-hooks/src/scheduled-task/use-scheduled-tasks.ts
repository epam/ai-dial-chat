import type {
  ListScheduledTasksSortEnum,
  ScheduledTaskDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScheduledTasksApiClient } from './scheduled-tasks-api-client';

export interface UseScheduledTasksOptions {
  enabled?: boolean;
  pageSize?: number;
  debounceMs?: number;
  initialSearch?: string;
  initialSort?: ListScheduledTasksSortEnum;
}

/** Shared scheduler-list lifecycle with generation-scoped stale-response guards. */
export const useScheduledTasks = (
  client: ScheduledTasksApiClient,
  {
    enabled = true,
    pageSize = 20,
    debounceMs = 300,
    initialSearch = '',
    initialSort = 'first_to_run' as ListScheduledTasksSortEnum,
  }: UseScheduledTasksOptions = {},
) => {
  const [items, setItems] = useState<ScheduledTaskDto[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortKey, setSortKey] = useState(initialSort);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialError, setInitialError] = useState<Error | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const offset = useRef(0);
  const loadingMore = useRef(false);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), debounceMs);
    return () => clearTimeout(timer);
  }, [debounceMs, searchQuery]);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    if (!enabled) {
      setIsLoading(false);
      setItems([]);
      setHasMore(false);
      return () => controller.abort();
    }
    const run = async () => {
      setIsLoading(true);
      setInitialError(null);
      setLoadMoreError(null);
      try {
        const page = await client.listScheduledTasks({
          limit: pageSize,
          offset: 0,
          search: debouncedSearch,
          sort: sortKey,
          signal: controller.signal,
        });
        if (generation.current !== current) return;
        setItems(page.items);
        offset.current = page.items.length;
        setHasMore(page.next != null);
      } catch (error) {
        if (generation.current === current)
          setInitialError(
            error instanceof Error
              ? error
              : new Error('Failed to load scheduled tasks'),
          );
      } finally {
        if (generation.current === current) setIsLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [client, debouncedSearch, enabled, pageSize, reload, sortKey]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || isLoading || loadingMore.current) return;
    loadingMore.current = true;
    const current = generation.current;
    const currentOffset = offset.current;
    void (async () => {
      setIsLoadingMore(true);
      setLoadMoreError(null);
      try {
        const page = await client.listScheduledTasks({
          limit: pageSize,
          offset: currentOffset,
          search: debouncedSearch,
          sort: sortKey,
        });
        if (generation.current !== current) return;
        setItems((previous) => [
          ...previous,
          ...page.items.filter(
            (item) => !new Set(previous.map(({ id }) => id)).has(item.id),
          ),
        ]);
        offset.current = currentOffset + page.items.length;
        setHasMore(page.next != null);
      } catch (error) {
        if (generation.current === current)
          setLoadMoreError(
            error instanceof Error
              ? error
              : new Error('Failed to load more scheduled tasks'),
          );
      } finally {
        if (generation.current === current) setIsLoadingMore(false);
        loadingMore.current = false;
      }
    })();
  }, [client, debouncedSearch, enabled, hasMore, isLoading, pageSize, sortKey]);

  const refetch = useCallback(() => setReload((value) => value + 1), []);
  return {
    items,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    isLoading,
    isLoadingMore,
    initialError,
    loadMoreError,
    hasMore,
    loadMore,
    retryLoadMore: loadMore,
    refetch,
  };
};
