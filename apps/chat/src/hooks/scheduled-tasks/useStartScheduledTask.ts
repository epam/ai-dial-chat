import {
  ScheduledTaskRunDtoStatusEnum,
  type ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  getScheduledTaskRun,
  startScheduledTask,
} from '../../server-api/scheduled-tasks.api';

const POLL_INTERVAL_MS = 2_000;
const POLL_DEADLINE_MS = 70_000;

export enum ScheduledTaskRunStatusFeedback {
  Unavailable = 'unavailable',
  Delayed = 'delayed',
}

interface PollingRun {
  id: string;
  deadline: number;
  retryAt?: number;
}

interface PollRequest {
  generation: number;
  allowPastDeadline: boolean;
}

/** Inputs controlling a manual scheduled-task launch for the current detail page. */
export interface UseStartScheduledTaskOptions {
  /** Identifier of the schedule currently displayed by the page. */
  scheduleId: string;
  /** Whether the scheduled-tasks feature is available to this user. */
  enabled: boolean;
  /** Whether the loaded task remains eligible for manual execution. */
  canStart: boolean;
  /** Runs from the ordinary history hook, used to stop fast polling on terminal state. */
  loadedRuns?: ScheduledTaskRunDto[];
}

const isTerminalRun = (run: ScheduledTaskRunDto): boolean =>
  run.status !== ScheduledTaskRunDtoStatusEnum.InProgress;

const getRetryAfterMs = (error: unknown): number | undefined => {
  if (error === null || typeof error !== 'object' || !('response' in error)) {
    return undefined;
  }
  const response = (error as { response?: Response }).response;
  const retryAfter = response?.headers.get('retry-after');
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(retryAfter);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
};

/** Combines accepted and server-loaded runs without allowing a terminal snapshot to regress. */
export const mergeScheduledTaskRuns = (
  acceptedRuns: ScheduledTaskRunDto[],
  loadedRuns: ScheduledTaskRunDto[],
): ScheduledTaskRunDto[] => {
  const merged: ScheduledTaskRunDto[] = [];
  const positions = new Map<string, number>();

  for (const run of [...acceptedRuns, ...loadedRuns]) {
    const position = positions.get(run.id);
    if (position === undefined) {
      positions.set(run.id, merged.length);
      merged.push(run);
      continue;
    }

    const existing = merged[position];
    if (
      existing.status === ScheduledTaskRunDtoStatusEnum.InProgress &&
      run.status !== ScheduledTaskRunDtoStatusEnum.InProgress
    ) {
      merged[position] = run;
    }
  }

  return merged;
};

/** Owns one page-scoped manual-run request and its accepted history entries. */
export const useStartScheduledTask = ({
  scheduleId,
  enabled,
  canStart,
  loadedRuns = [],
}: UseStartScheduledTaskOptions) => {
  const [acceptedRuns, setAcceptedRuns] = useState<ScheduledTaskRunDto[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] =
    useState<ScheduledTaskRunStatusFeedback>();
  const [terminalRun, setTerminalRun] = useState<ScheduledTaskRunDto>();
  const [pollRequest, setPollRequest] = useState<PollRequest>();
  const acceptedRunsRef = useRef<ScheduledTaskRunDto[]>([]);
  const requestInFlight = useRef(false);
  const getInFlight = useRef(false);
  const generation = useRef(0);
  const pollingRun = useRef<PollingRun | undefined>(undefined);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pollAbortController = useRef<AbortController | undefined>(undefined);
  const deadlineTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const canStartRef = useRef(canStart);
  const loadedRunsRef = useRef(loadedRuns);

  /*
   * Synced during commit, not in a passive effect: the Start button is enabled
   * as soon as this render commits, so a click that lands before passive
   * effects flush would otherwise read a stale ref and be silently dropped.
   */
  useLayoutEffect(() => {
    canStartRef.current = canStart;
  }, [canStart]);

  useLayoutEffect(() => {
    loadedRunsRef.current = loadedRuns;
  }, [loadedRuns]);

  const clearPolling = useCallback((keepTrackedRun = false) => {
    if (deadlineTimer.current) {
      clearTimeout(deadlineTimer.current);
      deadlineTimer.current = undefined;
    }
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = undefined;
    }
    pollAbortController.current?.abort();
    pollAbortController.current = undefined;
    if (!keepTrackedRun) pollingRun.current = undefined;
    getInFlight.current = false;
    setPollRequest(undefined);
    setIsRefreshingStatus(false);
  }, []);

  const updateAcceptedRun = useCallback((run: ScheduledTaskRunDto) => {
    const updatedRuns = mergeScheduledTaskRuns([run], acceptedRunsRef.current);
    acceptedRunsRef.current = updatedRuns;
    setAcceptedRuns(updatedRuns);
  }, []);

  const schedulePoll = useCallback(
    (delay: number, requestGeneration: number) => {
      if (!pollingRun.current || generation.current !== requestGeneration)
        return;
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = setTimeout(() => {
        pollTimer.current = undefined;
        setPollRequest({
          generation: requestGeneration,
          allowPastDeadline: false,
        });
      }, delay);
    },
    [],
  );

  useEffect(() => {
    if (!pollRequest) return;
    const { generation: requestGeneration, allowPastDeadline } = pollRequest;
    let cancelled = false;

    const poll = async () => {
      const currentPollingRun = pollingRun.current;
      if (
        !currentPollingRun ||
        getInFlight.current ||
        generation.current !== requestGeneration ||
        !enabled ||
        document.visibilityState === 'hidden' ||
        cancelled
      ) {
        return;
      }
      if (!allowPastDeadline && Date.now() >= currentPollingRun.deadline) {
        setStatusFeedback(ScheduledTaskRunStatusFeedback.Delayed);
        clearPolling(true);
        return;
      }
      if (currentPollingRun.retryAt && Date.now() < currentPollingRun.retryAt) {
        if (!allowPastDeadline) {
          schedulePoll(
            currentPollingRun.retryAt - Date.now(),
            requestGeneration,
          );
        }
        return;
      }

      getInFlight.current = true;
      setIsRefreshingStatus(true);
      const controller = new AbortController();
      pollAbortController.current = controller;

      try {
        const run = await getScheduledTaskRun(
          scheduleId,
          currentPollingRun.id,
          controller.signal,
        );
        if (
          generation.current !== requestGeneration ||
          cancelled ||
          controller.signal.aborted
        )
          return;

        updateAcceptedRun(run);
        setStatusFeedback(undefined);
        if (isTerminalRun(run)) {
          setTerminalRun(run);
          clearPolling();
          return;
        }
        if (Date.now() >= currentPollingRun.deadline) {
          setStatusFeedback(ScheduledTaskRunStatusFeedback.Delayed);
          clearPolling(true);
          return;
        }
        schedulePoll(POLL_INTERVAL_MS, requestGeneration);
      } catch (error) {
        if (
          generation.current !== requestGeneration ||
          cancelled ||
          controller.signal.aborted
        ) {
          return;
        }
        const { status } = await getApiErrorDetails(error);
        if (
          generation.current !== requestGeneration ||
          cancelled ||
          controller.signal.aborted
        )
          return;

        if (status === 401 || status === 403 || status === 404) {
          setStatusFeedback(ScheduledTaskRunStatusFeedback.Unavailable);
          clearPolling();
          return;
        }

        setStatusFeedback(ScheduledTaskRunStatusFeedback.Unavailable);
        const retryAfterMs = getRetryAfterMs(error);
        const nextDelay = Math.max(POLL_INTERVAL_MS, retryAfterMs ?? 0);
        currentPollingRun.retryAt = Date.now() + nextDelay;
        if (Date.now() + nextDelay >= currentPollingRun.deadline) {
          setStatusFeedback(ScheduledTaskRunStatusFeedback.Delayed);
          clearPolling(true);
          return;
        }
        schedulePoll(nextDelay, requestGeneration);
      } finally {
        if (
          generation.current === requestGeneration &&
          pollAbortController.current === controller
        ) {
          pollAbortController.current = undefined;
          getInFlight.current = false;
          setIsRefreshingStatus(false);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [
    clearPolling,
    enabled,
    pollRequest,
    scheduleId,
    schedulePoll,
    updateAcceptedRun,
  ]);

  useEffect(() => {
    generation.current += 1;
    clearPolling();
    requestInFlight.current = false;
    acceptedRunsRef.current = [];
    setIsStarting(false);
    setAcceptedRuns([]);
    setStatusFeedback(undefined);
    setTerminalRun(undefined);
    return () => {
      generation.current += 1;
      clearPolling();
    };
  }, [clearPolling, enabled, scheduleId]);

  useEffect(() => {
    const currentPollingRun = pollingRun.current;
    if (!currentPollingRun) return;

    const terminalRun = loadedRuns.find(
      (run) => run.id === currentPollingRun.id && isTerminalRun(run),
    );
    if (!terminalRun) return;

    updateAcceptedRun(terminalRun);
    setStatusFeedback(undefined);
    setTerminalRun(terminalRun);
    clearPolling();
  }, [clearPolling, loadedRuns, updateAcceptedRun]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const currentPollingRun = pollingRun.current;
      if (!currentPollingRun || getInFlight.current) return;

      const requestGeneration = generation.current;
      if (Date.now() >= currentPollingRun.deadline) {
        setStatusFeedback(ScheduledTaskRunStatusFeedback.Delayed);
        clearPolling(true);
        return;
      }
      if (pollTimer.current) clearTimeout(pollTimer.current);
      setPollRequest({
        generation: requestGeneration,
        allowPastDeadline: false,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearPolling]);

  const start = useCallback(async (): Promise<
    ScheduledTaskRunDto | undefined
  > => {
    if (
      !enabled ||
      !scheduleId ||
      !canStartRef.current ||
      requestInFlight.current ||
      mergeScheduledTaskRuns(
        acceptedRunsRef.current,
        loadedRunsRef.current,
      ).some((run) => run.status === ScheduledTaskRunDtoStatusEnum.InProgress)
    )
      return undefined;

    requestInFlight.current = true;
    setIsStarting(true);
    const requestGeneration = generation.current;

    try {
      const acceptedRun = await startScheduledTask(scheduleId);
      if (generation.current !== requestGeneration) return undefined;

      updateAcceptedRun(acceptedRun);
      setStatusFeedback(undefined);
      if (!isTerminalRun(acceptedRun)) {
        pollingRun.current = {
          id: acceptedRun.id,
          deadline: Date.now() + POLL_DEADLINE_MS,
        };
        schedulePoll(POLL_INTERVAL_MS, requestGeneration);
        deadlineTimer.current = setTimeout(() => {
          if (generation.current !== requestGeneration) return;
          setStatusFeedback(ScheduledTaskRunStatusFeedback.Delayed);
          clearPolling(true);
        }, POLL_DEADLINE_MS);
      }
      return acceptedRun;
    } catch (error) {
      if (generation.current !== requestGeneration) return undefined;
      throw error;
    } finally {
      if (generation.current === requestGeneration) {
        requestInFlight.current = false;
        setIsStarting(false);
      }
    }
  }, [clearPolling, enabled, schedulePoll, scheduleId, updateAcceptedRun]);

  const refreshStatus = useCallback((): void => {
    const currentPollingRun = pollingRun.current;
    if (!currentPollingRun || getInFlight.current || !enabled) return;
    if (currentPollingRun.retryAt && Date.now() < currentPollingRun.retryAt)
      return;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setPollRequest({ generation: generation.current, allowPastDeadline: true });
  }, [enabled]);

  return {
    acceptedRuns,
    isStarting,
    isRefreshingStatus,
    statusFeedback,
    terminalRun,
    start,
    refreshStatus,
  };
};
