import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useState } from 'react';
import { getApiErrorStatus } from '../api-error/api-error';
import { ActiveScheduledTaskDetailState } from './active-scheduled-task';

/** Host-supplied cancellable task loader. */
export type ActiveScheduledTaskLoader = (
  id: string,
  signal: AbortSignal,
) => Promise<ScheduledTaskDto>;
/** Current details and retry operation for one active schedule. */
export interface ActiveScheduledTaskDetails {
  /** Current request lifecycle. */
  taskState: ActiveScheduledTaskDetailState;
  /** Loaded details, or null before success. */
  task: ScheduledTaskDto | null;
  /** Failure other than an unavailable task. */
  taskError: Error | null;
  /** Starts another request for the current schedule. */
  retryTask: () => void;
}
/** Loads task details independently of run identity, ignoring superseded responses. */
export const useActiveScheduledTaskDetails = (
  scheduleId: string | undefined,
  getTask: ActiveScheduledTaskLoader,
): ActiveScheduledTaskDetails => {
  const [taskState, setTaskState] = useState<ActiveScheduledTaskDetailState>(
    ActiveScheduledTaskDetailState.Idle,
  );
  const [task, setTask] = useState<ScheduledTaskDto | null>(null);
  const [taskError, setTaskError] = useState<Error | null>(null);
  const [taskRetryToken, setTaskRetryToken] = useState(0);

  useEffect(() => {
    if (!scheduleId) {
      setTaskState(ActiveScheduledTaskDetailState.Idle);
      setTask(null);
      setTaskError(null);
      return;
    }

    setTaskState(ActiveScheduledTaskDetailState.Loading);
    setTask(null);
    setTaskError(null);
    const cancelled = { value: false };
    const controller = new AbortController();

    const load = async () => {
      try {
        const result = await getTask(scheduleId, controller.signal);
        if (cancelled.value) return;
        setTask(result);
        setTaskState(ActiveScheduledTaskDetailState.Success);
      } catch (err) {
        if (cancelled.value) return;
        if (getApiErrorStatus(err) === 404) {
          setTaskState(ActiveScheduledTaskDetailState.Unavailable);
        } else {
          setTaskError(
            err instanceof Error
              ? err
              : new Error('Failed to load the scheduled task'),
          );
          setTaskState(ActiveScheduledTaskDetailState.Error);
        }
      }
    };

    load();

    return () => {
      cancelled.value = true;
      controller.abort();
    };
    // Run identity does not participate in detail loading.
  }, [scheduleId, taskRetryToken, getTask]);

  const retryTask = useCallback(() => {
    setTaskRetryToken((token) => token + 1);
  }, []);

  return { taskState, task, taskError, retryTask };
};
