import { readSseEvents } from '../shared/read-sse-events';
import {
  parseProjectWatchEvent,
  type ProjectWatchEvent,
} from './project-events';
import type { ProjectsApiClient } from './projects-api-client';

/** Delays before each reconnect attempt of a dropped watch stream. */
export const WATCH_RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

/** One run of a projects watch stream, from its first open until it gives up or `signal` aborts. */
export interface ProjectWatchRun {
  /** The client's stream opener. */
  watchProjects: NonNullable<ProjectsApiClient['watchProjects']>;
  /** The project ids to watch. */
  ids: string[];
  /** Ends the run: the open stream is released and no reconnect fires. */
  signal: AbortSignal;
  /** Called with each well-formed event. */
  onEvent: (event: ProjectWatchEvent) => void;
  /** Called after a dropped stream was reopened, so the caller can catch up on the gap. */
  onReconnected: () => void;
  /** Called once when the watch cannot be opened or kept open, for the rest of the visit. */
  onUnavailable: () => void;
}

/**
 * Keeps a projects watch open: a stream that drops is reopened with a bounded
 * backoff, and a watch whose first open fails (a Core without project events,
 * a project no longer readable) or whose retries run out gives up.
 */
export const runProjectWatch = ({
  watchProjects,
  ids,
  signal,
  onEvent,
  onReconnected,
  onUnavailable,
}: ProjectWatchRun): void => {
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  signal.addEventListener('abort', () => clearTimeout(reconnectTimer), {
    once: true,
  });

  const handlePayload = (payload: unknown): boolean => {
    const event = parseProjectWatchEvent(payload);
    if (event != null) onEvent(event);
    return signal.aborted;
  };

  const scheduleReconnect = (failedAttempts: number) => {
    const delay = WATCH_RECONNECT_DELAYS_MS[failedAttempts];
    if (delay == null) {
      onUnavailable();
      return;
    }
    reconnectTimer = setTimeout(() => {
      void connect(failedAttempts, true);
    }, delay);
  };

  const connect = async (failedAttempts: number, isReconnect: boolean) => {
    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await watchProjects(ids, signal);
    } catch {
      if (signal.aborted) return;
      if (!isReconnect) {
        onUnavailable();
        return;
      }
      scheduleReconnect(failedAttempts + 1);
      return;
    }
    if (isReconnect) onReconnected();
    await readSseEvents(stream, handlePayload);
    if (signal.aborted) return;
    scheduleReconnect(0);
  };

  void connect(0, false);
};
