import type { ScheduledTaskRunDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScheduledTasksApiClient } from './scheduled-tasks-api-client';

export interface UseScheduledTaskRunsOptions {
  scheduleId: string;
  enabled?: boolean;
  pageSize?: number;
}

/** Shared, cancellation-safe pagination for one schedule's run history. */
export const useScheduledTaskRuns = (
  client: ScheduledTasksApiClient,
  { scheduleId, enabled = true, pageSize = 10 }: UseScheduledTaskRunsOptions,
) => {
  const [items, setItems] = useState<ScheduledTaskRunDto[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialError, setInitialError] = useState<Error | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const offset = useRef(0);
  const loadingMore = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    loadingMore.current = false;
    setIsLoadingMore(false);
    if (!enabled || !scheduleId) {
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
        const page = await client.listScheduledTaskRuns({
          scheduleId,
          limit: pageSize,
          offset: 0,
          signal: controller.signal,
        });
        if (generation.current !== current) return;
        setItems(page.items);
        offset.current = page.items.length;
        setHasMore(
          page.next != null ||
            (page.count != null
              ? page.items.length < page.count
              : page.items.length === pageSize),
        );
      } catch (error) {
        if (generation.current === current)
          setInitialError(
            error instanceof Error
              ? error
              : new Error('Failed to load scheduled task runs'),
          );
      } finally {
        if (generation.current === current) setIsLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [client, enabled, pageSize, reload, scheduleId]);

  const loadMore = useCallback(() => {
    if (!enabled || !scheduleId || !hasMore || isLoading || loadingMore.current)
      return;
    loadingMore.current = true;
    const current = generation.current;
    const currentOffset = offset.current;
    void (async () => {
      setIsLoadingMore(true);
      setLoadMoreError(null);
      try {
        const page = await client.listScheduledTaskRuns({
          scheduleId,
          limit: pageSize,
          offset: currentOffset,
        });
        if (generation.current !== current) return;
        setItems((previous) => [
          ...previous,
          ...page.items.filter(
            (item) => !new Set(previous.map(({ id }) => id)).has(item.id),
          ),
        ]);
        offset.current = currentOffset + page.items.length;
        setHasMore(
          page.next != null ||
            (page.count != null
              ? currentOffset + page.items.length < page.count
              : page.items.length === pageSize),
        );
      } catch (error) {
        if (generation.current === current)
          setLoadMoreError(
            error instanceof Error
              ? error
              : new Error('Failed to load more scheduled task runs'),
          );
      } finally {
        if (generation.current === current) setIsLoadingMore(false);
        loadingMore.current = false;
      }
    })();
  }, [client, enabled, hasMore, isLoading, pageSize, scheduleId]);

  const refetch = useCallback(() => setReload((value) => value + 1), []);
  return {
    items,
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
