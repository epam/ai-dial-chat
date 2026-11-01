import { ProjectSource } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectsApiClient } from '../projects-api-client';
import { useProjects } from '../use-projects';

const ALPHA = 'projects/b/alpha';
const BETA = 'projects/b/beta';

const dto = (id: string, updatedAt?: number) => ({
  id,
  name: id.split('/').pop() ?? id,
  bucket: 'b',
  path: id.split('/').pop() ?? id,
  source: ProjectSource.Personal,
  updatedAt,
});

const listing = (...items: ReturnType<typeof dto>[]) => ({
  items,
  incompleteSources: [],
});

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

const createClient = () => ({
  listProjects: vi.fn<ProjectsApiClient['listProjects']>(),
  watchProjects: vi.fn<NonNullable<ProjectsApiClient['watchProjects']>>(),
});

describe('useProjects — live updates', () => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens one watch for the listed ids once the list loads', async () => {
    client.listProjects.mockResolvedValue(listing(dto(BETA), dto(ALPHA)));
    client.watchProjects.mockResolvedValue(createWatchStream().stream);

    renderHook(() => useProjects(client, true));

    await waitFor(() => expect(client.watchProjects).toHaveBeenCalledOnce());
    expect(client.watchProjects).toHaveBeenCalledWith(
      [ALPHA, BETA],
      expect.any(AbortSignal),
    );
  });

  it('subscribes to at most 1000 projects', async () => {
    client.listProjects.mockResolvedValue(
      listing(
        ...Array.from({ length: 1001 }, (_, index) =>
          dto(`projects/b/p${index}`),
        ),
      ),
    );
    client.watchProjects.mockResolvedValue(createWatchStream().stream);

    renderHook(() => useProjects(client, true));

    await waitFor(() => expect(client.watchProjects).toHaveBeenCalledOnce());
    expect(client.watchProjects.mock.calls[0][0]).toHaveLength(1000);
  });

  it('moves a project forward on an update without reopening the watch', async () => {
    const watch = createWatchStream();
    client.listProjects.mockResolvedValue(listing(dto(ALPHA, 1000)));
    client.watchProjects.mockResolvedValue(watch.stream);
    const { result } = renderHook(() => useProjects(client, true));
    await waitFor(() => expect(client.watchProjects).toHaveBeenCalledOnce());

    act(() => watch.send({ id: ALPHA, action: 'UPDATE', timestamp: 5000 }));

    await waitFor(() =>
      expect(result.current.projects[0].updatedAt).toBe(5000),
    );
    expect(client.watchProjects).toHaveBeenCalledOnce();
  });

  it('keeps the list reference for an older event', async () => {
    const watch = createWatchStream();
    client.listProjects.mockResolvedValue(listing(dto(ALPHA, 5000), dto(BETA)));
    client.watchProjects.mockResolvedValue(watch.stream);
    const { result } = renderHook(() => useProjects(client, true));
    await waitFor(() => expect(client.watchProjects).toHaveBeenCalledOnce());
    const before = result.current.projects;

    act(() => {
      watch.send({ id: ALPHA, action: 'UPDATE', timestamp: 4000 });
      watch.send({ id: BETA, action: 'UPDATE', timestamp: 6000 });
    });

    await waitFor(() =>
      expect(result.current.projects[1].updatedAt).toBe(6000),
    );
    expect(result.current.projects[0]).toBe(before[0]);
    expect(result.current.projects[0].updatedAt).toBe(5000);
  });

  it('removes a deleted project without reopening the watch', async () => {
    const watch = createWatchStream();
    client.listProjects.mockResolvedValue(listing(dto(ALPHA), dto(BETA)));
    client.watchProjects.mockResolvedValue(watch.stream);
    const { result } = renderHook(() => useProjects(client, true));
    await waitFor(() => expect(client.watchProjects).toHaveBeenCalledOnce());

    act(() => watch.send({ id: ALPHA, action: 'DELETE', timestamp: 6000 }));

    await waitFor(() =>
      expect(result.current.projects.map(({ id }) => id)).toEqual([BETA]),
    );
    expect(client.watchProjects).toHaveBeenCalledOnce();
  });

  it('leaves the page as it was and never retries when the watch cannot be opened', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    client.listProjects.mockResolvedValue(listing(dto(ALPHA, 1000)));
    client.watchProjects.mockRejectedValue(new Error('400'));
    const { result } = renderHook(() => useProjects(client, true));
    await waitFor(() => expect(client.watchProjects).toHaveBeenCalledOnce());

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(client.watchProjects).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({ isLoading: false, hasError: false });
    expect(result.current.projects).toHaveLength(1);
  });

  it('reconnects a dropped stream after a second and reloads silently', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = createWatchStream();
    client.listProjects
      .mockResolvedValueOnce(listing(dto(ALPHA, 1000)))
      .mockResolvedValueOnce(listing(dto(ALPHA, 9000)));
    client.watchProjects
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(createWatchStream().stream);
    const loadingStates: boolean[] = [];
    const { result } = renderHook(() => {
      const state = useProjects(client, true);
      loadingStates.push(state.isLoading);
      return state;
    });
    await waitFor(() => expect(client.watchProjects).toHaveBeenCalledOnce());
    const loadedAt = loadingStates.lastIndexOf(true) + 1;

    act(() => first.close());
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await waitFor(() =>
      expect(result.current.projects[0].updatedAt).toBe(9000),
    );
    expect(client.watchProjects).toHaveBeenCalledTimes(2);
    expect(client.listProjects).toHaveBeenCalledTimes(2);
    expect(loadingStates.slice(loadedAt)).not.toContain(true);
  });

  it('aborts the watch on unmount', async () => {
    client.listProjects.mockResolvedValue(listing(dto(ALPHA)));
    client.watchProjects.mockResolvedValue(createWatchStream().stream);
    const { unmount } = renderHook(() => useProjects(client, true));
    await waitFor(() => expect(client.watchProjects).toHaveBeenCalledOnce());
    const signal = client.watchProjects.mock.calls[0][1] as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('works without live updates for a client that cannot watch', async () => {
    client.listProjects.mockResolvedValue(listing(dto(ALPHA)));
    const { result } = renderHook(() =>
      useProjects({ listProjects: client.listProjects }, true),
    );

    await waitFor(() => expect(result.current.projects).toHaveLength(1));
    expect(client.watchProjects).not.toHaveBeenCalled();
  });
});
