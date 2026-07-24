import type { ScheduledTaskDto } from '@epam/chat-api-client';
import { useCallback, useEffect, useState } from 'react';
import { listScheduledTasks } from '../../server-api/scheduled-tasks.api';

/** Result of {@link useScheduledTasks}. */
interface UseScheduledTasksResult {
  /** Fetched scheduled tasks. Empty until the first successful fetch resolves. */
  items: ScheduledTaskDto[];
  /** Whether a fetch (initial or triggered by `refetch`) is in flight. */
  isLoading: boolean;
  /** Set when the most recent fetch failed; `null` otherwise. */
  error: Error | null;
  /** Triggers a new fetch, e.g. after returning from the create flow or on retry. */
  refetch: () => void;
}

/**
 * Fetches the scheduled tasks list when enabled and on demand via `refetch`.
 * Aborts the in-flight request and skips state updates if the component
 * unmounts or a new fetch is triggered before the previous one resolves.
 */
export const useScheduledTasks = (enabled = true): UseScheduledTasksResult => {
  const [items, setItems] = useState<ScheduledTaskDto[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);

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
        const response = await listScheduledTasks(controller.signal);
        if (!cancelled.value) {
          setItems(response.items);
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
  }, [enabled, refetchToken]);

  const refetch = useCallback(() => {
    if (enabled) {
      setRefetchToken((token) => token + 1);
    }
  }, [enabled]);

  return { items, isLoading, error, refetch };
};
