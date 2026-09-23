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
  const moreController = useRef<AbortController | null>(null);

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
    if (!enabled || !scheduleId) {
      setIsLoading(false);
      setItems([]);
      setHasMore(false);
      return cleanup;
    }
    const run = async () => {
      setIsLoading(true);
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
    return cleanup;
  }, [client, enabled, pageSize, reload, scheduleId]);

  const loadMore = useCallback(() => {
    if (!enabled || !scheduleId || !hasMore || isLoading || loadingMore.current)
      return;
    loadingMore.current = true;
    const controller = new AbortController();
    moreController.current = controller;
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
          signal: controller.signal,
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
        if (generation.current === current) {
          setIsLoadingMore(false);
          loadingMore.current = false;
          moreController.current = null;
        }
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
