import {
  ScheduledTaskRunDtoStatusEnum,
  type ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScheduledTasksApiClient } from './scheduled-tasks-api-client';

export interface UseScheduledTaskRunsOptions {
  scheduleId: string;
  enabled?: boolean;
  pageSize?: number;
  /**
   * The task's next scheduled run time (ISO string), when known. Drives the
   * one-shot background refresh described on {@link useScheduledTaskRuns}.
   * The caller already holds the task DTO — this hook never fetches it.
   */
  nextRunTime?: string | null;
}

/**
 * Background-refresh timing for scheduled-task run history. 15s sits inside
 * the ~10-15s range considered acceptable for per-panel polling against an
 * uncached, unthrottled proxy endpoint; 20 consecutive no-change polls
 * (5 minutes) bounds how long a stuck upstream run keeps a background tab
 * polling. See design.md - Risks for the DIAL Scheduler capacity assumption.
 */
const RUNS_POLL_INTERVAL_MS = 15_000;
const RUNS_POLL_STOP_AFTER_NO_CHANGE = 20;
const NEXT_RUN_REFRESH_DELAY_MS = 5_000;

/* setTimeout's delay is a 32-bit signed int — a longer value silently
   overflows and fires immediately, which a monthly-or-less-frequent cron
   schedule's nextRunTime can exceed (~24.8 days out). */
const MAX_SAFE_TIMEOUT_MS = 2_147_483_647;

/**
 * `setTimeout` that chains through `MAX_SAFE_TIMEOUT_MS`-sized steps for a
 * total delay beyond the 32-bit limit, instead of overflowing. Returns a
 * canceller that clears whichever step is currently pending.
 */
const scheduleAfter = (delayMs: number, callback: () => void): (() => void) => {
  if (delayMs <= MAX_SAFE_TIMEOUT_MS) {
    const id = setTimeout(callback, Math.max(delayMs, 0));
    return () => clearTimeout(id);
  }
  let cancelStep: () => void;
  const id = setTimeout(() => {
    cancelStep = scheduleAfter(delayMs - MAX_SAFE_TIMEOUT_MS, callback);
  }, MAX_SAFE_TIMEOUT_MS);
  cancelStep = () => clearTimeout(id);
  return () => cancelStep();
};

/**
 * Merges a freshly-fetched page 0 into the currently-loaded run list: an
 * already-known id is replaced in place at its existing array position, an
 * unseen id is prepended (upstream order is `created_at desc`, so it is the
 * newest), and an id absent from `incoming` is left untouched — a background
 * refresh never removes a loaded run.
 */
export const mergeRunsById = (
  current: ScheduledTaskRunDto[],
  incoming: ScheduledTaskRunDto[],
): ScheduledTaskRunDto[] => {
  const incomingById = new Map(incoming.map((run) => [run.id, run]));
  const currentIds = new Set(current.map((run) => run.id));
  const updatedInPlace = current.map((run) => incomingById.get(run.id) ?? run);
  const newRuns = incoming.filter((run) => !currentIds.has(run.id));
  return [...newRuns, ...updatedInPlace];
};

const didMergeChangeAnything = (
  previous: ScheduledTaskRunDto[],
  merged: ScheduledTaskRunDto[],
): boolean => {
  if (previous.length !== merged.length) return true;
  const previousById = new Map(previous.map((run) => [run.id, run]));
  return merged.some((run) => {
    const before = previousById.get(run.id);
    return !before || JSON.stringify(before) !== JSON.stringify(run);
  });
};

/** Outcome of one background-refresh attempt (poll tick, one-shot, or catch-up). */
enum BackgroundRefreshResult {
  /** Not attempted — a foreground fetch was in flight, or the response was stale. */
  Skipped = 'skipped',
  /** Attempted and resolved, but the merge left `items` unchanged. */
  Unchanged = 'unchanged',
  /** Attempted and resolved, and the merge updated or added a run. */
  Changed = 'changed',
  /** Attempted and rejected (network failure, non-abort error). */
  Error = 'error',
}

/** Shared, cancellation-safe pagination and background refresh for one schedule's run history. */
export const useScheduledTaskRuns = (
  client: ScheduledTasksApiClient,
  {
    scheduleId,
    enabled = true,
    pageSize = 10,
    nextRunTime,
  }: UseScheduledTaskRunsOptions,
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
  const itemsRef = useRef(items);
  const isLoadingRef = useRef(isLoading);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const backgroundController = useRef<AbortController | null>(null);
  const noChangeCount = useRef(0);
  const handledPastNextRunTime = useRef<string | null>(null);
  const missedWhileHidden = useRef(false);

  itemsRef.current = items;
  isLoadingRef.current = isLoading;
  isLoadingMoreRef.current = isLoadingMore;

  const hasInProgressRun = items.some(
    (run) => run.status === ScheduledTaskRunDtoStatusEnum.InProgress,
  );

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    moreController.current?.abort();
    moreController.current = null;
    backgroundController.current?.abort();
    backgroundController.current = null;
    loadingMore.current = false;
    noChangeCount.current = 0;
    handledPastNextRunTime.current = null;
    missedWhileHidden.current = false;
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
      backgroundController.current?.abort();
      backgroundController.current = null;
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

  /**
   * Re-fetches page 0 and merges the response into `items` by id, without
   * resetting pagination — the primitive every background-refresh trigger
   * shares. Never runs over a foreground fetch, never surfaces its own
   * failure, and carries its own `AbortController` distinct from the initial
   * fetch's and `loadMore`'s.
   */
  const backgroundRefresh =
    useCallback(async (): Promise<BackgroundRefreshResult> => {
      if (isLoadingRef.current || isLoadingMoreRef.current) {
        return BackgroundRefreshResult.Skipped;
      }
      const requestGeneration = generation.current;
      const controller = new AbortController();
      backgroundController.current?.abort();
      backgroundController.current = controller;
      try {
        const page = await client.listScheduledTaskRuns({
          scheduleId,
          limit: pageSize,
          offset: 0,
          signal: controller.signal,
        });
        if (generation.current !== requestGeneration) {
          return BackgroundRefreshResult.Skipped;
        }
        /* Re-checked after the await: a loadMore() invoked while this
           request was in flight sets isLoadingMore synchronously, well
           before its own response arrives — deferring here rather than
           merging avoids clobbering whatever loadMore is about to append. */
        if (isLoadingRef.current || isLoadingMoreRef.current) {
          return BackgroundRefreshResult.Skipped;
        }
        const previous = itemsRef.current;
        const merged = mergeRunsById(previous, page.items);
        const changed = didMergeChangeAnything(previous, merged);
        /* Computed here rather than inside setItems' updater, so `changed`
           is read synchronously right after — not tied to React's internal
           eager-updater timing. */
        if (changed) {
          itemsRef.current = merged;
          setItems(merged);
        }
        return changed
          ? BackgroundRefreshResult.Changed
          : BackgroundRefreshResult.Unchanged;
      } catch {
        return BackgroundRefreshResult.Error;
      } finally {
        if (backgroundController.current === controller) {
          backgroundController.current = null;
        }
      }
    }, [client, scheduleId, pageSize]);

  /**
   * Runs `backgroundRefresh` unless the tab is hidden, in which case it
   * records the miss for the shared visibility-catch-up effect to pick up.
   */
  const attemptBackgroundRefresh = useCallback(() => {
    if (document.visibilityState !== 'visible') {
      missedWhileHidden.current = true;
      return;
    }
    void backgroundRefresh();
  }, [backgroundRefresh]);

  /* Trigger 1: poll while a run is in progress. Kept in its own effect —
     not merged with the one-shot trigger below — so a hasInProgressRun
     toggle mid-window can never tear down and lose the one-shot's pending
     timeout. */
  useEffect(() => {
    if (!enabled || !scheduleId || !hasInProgressRun) return undefined;
    noChangeCount.current = 0;
    let intervalId: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        missedWhileHidden.current = true;
        return;
      }
      void (async () => {
        const result = await backgroundRefresh();
        if (result === BackgroundRefreshResult.Changed) {
          noChangeCount.current = 0;
          return;
        }
        /* An error counts the same as no change — a permanently-failing
           upstream still hits the stop condition instead of polling
           forever. */
        if (
          result === BackgroundRefreshResult.Unchanged ||
          result === BackgroundRefreshResult.Error
        ) {
          noChangeCount.current += 1;
          if (
            noChangeCount.current >= RUNS_POLL_STOP_AFTER_NO_CHANGE &&
            intervalId !== null
          ) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      })();
    }, RUNS_POLL_INTERVAL_MS);
    return () => {
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [enabled, scheduleId, hasInProgressRun, backgroundRefresh]);

  // Trigger 2: a one-shot refresh shortly after a future nextRunTime.
  useEffect(() => {
    if (!enabled || !scheduleId || !nextRunTime) return undefined;
    const target = new Date(nextRunTime).getTime();
    if (Number.isNaN(target) || target <= Date.now()) return undefined;
    return scheduleAfter(
      target - Date.now() + NEXT_RUN_REFRESH_DELAY_MS,
      () => {
        /* Claims this nextRunTime so Trigger 3 does not redundantly
           re-fire for it once the instant has passed (e.g. after a later
           loadMore). */
        handledPastNextRunTime.current = nextRunTime;
        attemptBackgroundRefresh();
      },
    );
  }, [enabled, scheduleId, nextRunTime, attemptBackgroundRefresh]);

  /* Shared visibility catch-up: at most one refresh, covering whichever
     trigger above (or the past-due trigger below) missed one while hidden. */
  useEffect(() => {
    if (!enabled || !scheduleId) return undefined;
    const handleVisibilityChange = () => {
      if (
        document.visibilityState !== 'visible' ||
        !missedWhileHidden.current
      ) {
        return;
      }
      void (async () => {
        const result = await backgroundRefresh();
        /* A skipped attempt (foreground fetch still in flight) leaves the
           miss recorded so the next visibility toggle can retry it. */
        if (result !== BackgroundRefreshResult.Skipped) {
          missedWhileHidden.current = false;
        }
      })();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, scheduleId, backgroundRefresh]);

  /* Trigger 3: an already-past nextRunTime refreshes once. Deferral until
     isLoading/isLoadingMore settle happens implicitly — this effect just
     re-runs once those deps change — rather than via an explicit retry. */
  useEffect(() => {
    if (!enabled || !scheduleId || !nextRunTime) return;
    if (isLoading || isLoadingMore) return;
    const target = new Date(nextRunTime).getTime();
    if (Number.isNaN(target) || target > Date.now()) return;
    if (handledPastNextRunTime.current === nextRunTime) return;
    handledPastNextRunTime.current = nextRunTime;
    attemptBackgroundRefresh();
  }, [
    enabled,
    scheduleId,
    nextRunTime,
    isLoading,
    isLoadingMore,
    attemptBackgroundRefresh,
  ]);

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
