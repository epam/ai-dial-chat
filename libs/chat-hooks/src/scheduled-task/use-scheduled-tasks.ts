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
  const moreController = useRef<AbortController | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), debounceMs);
    return () => clearTimeout(timer);
  }, [debounceMs, searchQuery]);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    moreController.current?.abort();
    moreController.current = null;
    loadingMore.current = false;
    setIsLoadingMore(false);
    setInitialError(null);
    setLoadMoreError(null);
    setItems([]);
    setHasMore(false);
    offset.current = 0;
    const cleanup = () => {
      ++generation.current;
      controller.abort();
      moreController.current?.abort();
      moreController.current = null;
    };
    if (!enabled) {
      setIsLoading(false);
      setItems([]);
      setHasMore(false);
      return cleanup;
    }
    const run = async () => {
      setIsLoading(true);
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
    return cleanup;
  }, [client, debouncedSearch, enabled, pageSize, reload, sortKey]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || isLoading || loadingMore.current) return;
    loadingMore.current = true;
    const controller = new AbortController();
    moreController.current = controller;
    const current = generation.current;
    const currentOffset = offset.current;
    void (async () => {
      setIsLoadingMore(true);
      setLoadMoreError(null);
      try {
        const page = await client.listScheduledTasks({
          limit: pageSize,
          offset: currentOffset,
          signal: controller.signal,
          search: debouncedSearch,
          sort: sortKey,
        });
        if (generation.current !== current) return;
        setItems((previous) => {
          const ids = new Set(previous.map(({ id }) => id));
          return [
            ...previous,
            ...page.items.filter(({ id }) => {
              if (ids.has(id)) return false;
              ids.add(id);
              return true;
            }),
          ];
        });
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
        if (generation.current === current) {
          setIsLoadingMore(false);
          loadingMore.current = false;
          moreController.current = null;
        }
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
