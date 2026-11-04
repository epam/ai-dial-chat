import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  runProjectWatch,
  WATCH_RECONNECT_DELAYS_MS,
} from '../project-watch-stream';
import type { ProjectsApiClient } from '../projects-api-client';

const ID = 'projects/b/alpha';

/** A watch stream the test feeds and closes. */
const createWatchStream = () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });
  return {
    stream,
    send: (event: object) =>
      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`),
      ),
    close: () => controller.close(),
  };
};

const start = (
  watchProjects: NonNullable<ProjectsApiClient['watchProjects']>,
) => {
  const controller = new AbortController();
  const handlers = {
    onEvent: vi.fn(),
    onReconnected: vi.fn(),
    onUnavailable: vi.fn(),
  };
  runProjectWatch({
    watchProjects,
    ids: [ID],
    signal: controller.signal,
    ...handlers,
  });
  return { controller, ...handlers };
};

describe('runProjectWatch', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forwards well-formed events and ignores malformed payloads', async () => {
    const watch = createWatchStream();
    const run = start(vi.fn().mockResolvedValue(watch.stream));

    watch.send({ id: ID, action: 'UPDATE', timestamp: 1, etag: '"e"' });
    watch.send({ nope: true });

    await vi.waitFor(() =>
      expect(run.onEvent).toHaveBeenCalledWith({
        id: ID,
        action: 'UPDATE',
        timestamp: 1,
        etag: '"e"',
      }),
    );
    expect(run.onEvent).toHaveBeenCalledOnce();
  });

  it('reopens a dropped stream after the first delay and reports the reconnect', async () => {
    vi.useFakeTimers();
    const first = createWatchStream();
    const second = createWatchStream();
    const watchProjects = vi
      .fn()
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);
    const run = start(watchProjects);
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    first.close();
    await vi.advanceTimersByTimeAsync(WATCH_RECONNECT_DELAYS_MS[0]);

    expect(watchProjects).toHaveBeenCalledTimes(2);
    expect(run.onReconnected).toHaveBeenCalledOnce();
    expect(run.onUnavailable).not.toHaveBeenCalled();
  });

  it('gives up without retrying when the first open fails', async () => {
    vi.useFakeTimers();
    const watchProjects = vi.fn().mockRejectedValue(new Error('400'));
    const run = start(watchProjects);

    await vi.waitFor(() => expect(run.onUnavailable).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(60_000);

    expect(watchProjects).toHaveBeenCalledOnce();
  });

  it('gives up once every reconnect delay is spent', async () => {
    vi.useFakeTimers();
    const first = createWatchStream();
    const watchProjects = vi
      .fn()
      .mockResolvedValueOnce(first.stream)
      .mockRejectedValue(new Error('down'));
    const run = start(watchProjects);
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    first.close();
    for (const delay of WATCH_RECONNECT_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(delay);
    }

    expect(run.onUnavailable).toHaveBeenCalledOnce();
    /* The first open plus one reopen per delay. */
    expect(watchProjects).toHaveBeenCalledTimes(
      WATCH_RECONNECT_DELAYS_MS.length + 1,
    );
  });

  it('schedules no reconnect after the signal aborts', async () => {
    vi.useFakeTimers();
    const first = createWatchStream();
    const watchProjects = vi.fn().mockResolvedValue(first.stream);
    const run = start(watchProjects);
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    run.controller.abort();
    first.close();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(watchProjects).toHaveBeenCalledOnce();
    expect(run.onReconnected).not.toHaveBeenCalled();
  });
});
