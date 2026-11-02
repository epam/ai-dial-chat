import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WATCH_RECONNECT_DELAYS_MS } from '../project-watch-stream';
import type { ProjectsApiClient } from '../projects-api-client';
import {
  useProjectWatch,
  type ProjectWatchOptions,
} from '../use-project-watch';

const ID = 'projects/a1b2c3/q4';
const OTHER = 'projects/a1b2c3/other';

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

const update = (etag: string, id = ID) => ({
  id,
  action: 'UPDATE',
  timestamp: 1,
  etag,
});

/** A promise the test settles by hand. */
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe('useProjectWatch', () => {
  let watchProjects: ReturnType<
    typeof vi.fn<NonNullable<ProjectsApiClient['watchProjects']>>
  >;
  let client: Pick<ProjectsApiClient, 'watchProjects'>;

  beforeEach(() => {
    watchProjects = vi.fn<NonNullable<ProjectsApiClient['watchProjects']>>();
    client = { watchProjects };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWatch = (
    options: Partial<ProjectWatchOptions> = {},
    projectId: string | null = ID,
  ) => {
    const onChange = vi.fn(async () => undefined);
    const onDelete = vi.fn();
    const initial = { etag: '"e1"', onChange, onDelete, ...options };
    const view = renderHook(
      ({ id, opts }: { id: string | null; opts: ProjectWatchOptions }) =>
        useProjectWatch(client, id, opts),
      { initialProps: { id: projectId, opts: initial } },
    );
    return { ...view, onChange: initial.onChange, onDelete, initial };
  };

  it('opens the watch for the one project once its snapshot is loaded', async () => {
    watchProjects.mockResolvedValue(createWatchStream().stream);
    const { rerender, initial } = renderWatch({ etag: undefined });
    expect(watchProjects).not.toHaveBeenCalled();

    rerender({ id: ID, opts: { ...initial, etag: '"e1"' } });

    await vi.waitFor(() =>
      expect(watchProjects).toHaveBeenCalledWith([ID], expect.anything()),
    );
  });

  it('attempts no watch for a client without watch support', () => {
    client = {};
    const { onChange } = renderWatch();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refreshes on an update with a new etag', async () => {
    const watch = createWatchStream();
    watchProjects.mockResolvedValue(watch.stream);
    const { onChange } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    watch.send(update('"e2"'));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
  });

  it('skips an update for the loaded etag and one for another project', async () => {
    const watch = createWatchStream();
    watchProjects.mockResolvedValue(watch.stream);
    const { onChange } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    watch.send(update('"e1"'));
    watch.send(update('"e9"', OTHER));
    watch.send(update('"e2"'));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
  });

  it('collapses a burst during one refresh into exactly one trailing refresh', async () => {
    const watch = createWatchStream();
    watchProjects.mockResolvedValue(watch.stream);
    const first = deferred();
    const onChange = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    renderWatch({ onChange });
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    watch.send(update('"e2"'));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    for (let i = 3; i < 8; i++) watch.send(update(`"e${i}"`));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onChange).toHaveBeenCalledOnce();

    first.resolve();

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('calls onDelete once and stops on a delete', async () => {
    const watch = createWatchStream();
    watchProjects.mockResolvedValue(watch.stream);
    const { onChange, onDelete } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    watch.send({ id: ID, action: 'DELETE', timestamp: 2 });
    watch.send(update('"e2"'));
    watch.send({ id: ID, action: 'DELETE', timestamp: 3 });

    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refreshes once after a dropped stream is reopened', async () => {
    vi.useFakeTimers();
    const first = createWatchStream();
    watchProjects
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(createWatchStream().stream);
    const { onChange } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    first.close();
    await vi.advanceTimersByTimeAsync(WATCH_RECONNECT_DELAYS_MS[0]);

    expect(watchProjects).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('does not retry a watch that cannot be opened', async () => {
    vi.useFakeTimers();
    watchProjects.mockRejectedValue(new Error('400'));
    const { rerender, initial } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    await vi.advanceTimersByTimeAsync(60_000);
    rerender({ id: ID, opts: { ...initial, etag: '"e2"' } });

    expect(watchProjects).toHaveBeenCalledOnce();
  });

  it('tries again for another project after one could not be opened', async () => {
    watchProjects
      .mockRejectedValueOnce(new Error('403'))
      .mockResolvedValue(createWatchStream().stream);
    const { rerender, initial } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 10));

    rerender({ id: OTHER, opts: initial });

    await vi.waitFor(() =>
      expect(watchProjects).toHaveBeenLastCalledWith(
        [OTHER],
        expect.anything(),
      ),
    );
  });

  it('aborts the stream on unmount', async () => {
    watchProjects.mockResolvedValue(createWatchStream().stream);
    const { unmount } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
    const signal = watchProjects.mock.calls[0][1] as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('aborts the old stream and opens a new one when the id changes', async () => {
    watchProjects.mockImplementation(async () => createWatchStream().stream);
    const { rerender, initial } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
    const signal = watchProjects.mock.calls[0][1] as AbortSignal;

    rerender({ id: OTHER, opts: initial });

    expect(signal.aborted).toBe(true);
    await vi.waitFor(() =>
      expect(watchProjects).toHaveBeenLastCalledWith(
        [OTHER],
        expect.anything(),
      ),
    );
  });

  it('does not resubscribe for new callbacks or a refreshed etag', async () => {
    watchProjects.mockResolvedValue(createWatchStream().stream);
    const { rerender } = renderWatch();
    await vi.waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

    rerender({
      id: ID,
      opts: {
        etag: '"e2"',
        onChange: vi.fn(async () => undefined),
        onDelete: vi.fn(),
      },
    });

    expect(watchProjects).toHaveBeenCalledOnce();
  });
});
