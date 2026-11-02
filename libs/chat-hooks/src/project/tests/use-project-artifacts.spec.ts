import type { ProjectArtifactListResponseDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectArtifacts } from '../use-project-artifacts';

const PROJECT_ID = 'projects/a1b2c3/q4';
const OTHER_ID = 'projects/a1b2c3/other';

const page = (...names: string[]): ProjectArtifactListResponseDto => ({
  items: names.map((name, index) => ({
    name,
    updatedAt: names.length - index,
  })),
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const makeClient = () => ({
  listProjectArtifacts: vi.fn(async (_id: string, _signal?: AbortSignal) =>
    page('report.pdf'),
  ),
});

describe('useProjectArtifacts', () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    client = makeClient();
  });

  it("reads the project's outputs once", async () => {
    const { result } = renderHook(() =>
      useProjectArtifacts(client, PROJECT_ID),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toEqual([
      { name: 'report.pdf', updatedAt: 1 },
    ]);
    expect(result.current.hasError).toBe(false);
    expect(client.listProjectArtifacts).toHaveBeenCalledOnce();
    expect(client.listProjectArtifacts).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.any(AbortSignal),
    );
  });

  it('sends no request without a project id', () => {
    const { result } = renderHook(() => useProjectArtifacts(client, null));

    expect(result.current).toMatchObject({
      items: [],
      isLoading: false,
      hasError: false,
    });
    expect(client.listProjectArtifacts).not.toHaveBeenCalled();
  });

  it('reports a failed read and reads again on retry', async () => {
    client.listProjectArtifacts.mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() =>
      useProjectArtifacts(client, PROJECT_ID),
    );

    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.items).toEqual([]);

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.hasError).toBe(false);
    expect(client.listProjectArtifacts).toHaveBeenCalledTimes(2);
  });

  it('keeps the error while a retry reads, and clears it when the read succeeds', async () => {
    client.listProjectArtifacts.mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() =>
      useProjectArtifacts(client, PROJECT_ID),
    );
    await waitFor(() => expect(result.current.hasError).toBe(true));
    const next = deferred<ProjectArtifactListResponseDto>();
    client.listProjectArtifacts.mockReturnValueOnce(next.promise);

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.hasError).toBe(true);

    await act(async () => {
      next.resolve(page('report.pdf'));
      await next.promise;
    });

    expect(result.current.hasError).toBe(false);
    expect(result.current.items).toHaveLength(1);
  });

  it('reads again when a refresh arrives during the first read', async () => {
    const first = deferred<ProjectArtifactListResponseDto>();
    client.listProjectArtifacts
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(page('summary.md', 'report.pdf'));
    const { result } = renderHook(() =>
      useProjectArtifacts(client, PROJECT_ID),
    );

    await act(() => result.current.refresh());
    await act(async () => {
      first.resolve(page('report.pdf'));
      await first.promise;
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(client.listProjectArtifacts).toHaveBeenCalledTimes(2);
    expect(result.current.items.map((item) => item.name)).toEqual([
      'summary.md',
      'report.pdf',
    ]);
  });

  it("does not carry one project's error into another project's read", async () => {
    client.listProjectArtifacts.mockRejectedValueOnce(new Error('down'));
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useProjectArtifacts(client, id),
      { initialProps: { id: PROJECT_ID } },
    );
    await waitFor(() => expect(result.current.hasError).toBe(true));
    const next = deferred<ProjectArtifactListResponseDto>();
    client.listProjectArtifacts.mockReturnValueOnce(next.promise);

    rerender({ id: OTHER_ID });

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.hasError).toBe(false);
  });

  it('refreshes silently without touching the loading flags', async () => {
    const { result } = renderHook(() =>
      useProjectArtifacts(client, PROJECT_ID),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const next = deferred<ProjectArtifactListResponseDto>();
    client.listProjectArtifacts.mockReturnValueOnce(next.promise);

    let refreshing!: Promise<void>;
    act(() => {
      refreshing = result.current.refresh();
    });
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      next.resolve(page('summary.md', 'report.pdf'));
      await refreshing;
    });

    expect(result.current.items.map((item) => item.name)).toEqual([
      'summary.md',
      'report.pdf',
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('keeps the shown outputs when a refresh fails', async () => {
    const { result } = renderHook(() =>
      useProjectArtifacts(client, PROJECT_ID),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    client.listProjectArtifacts.mockRejectedValueOnce(new Error('down'));

    await act(() => result.current.refresh());

    expect(result.current.items).toEqual([
      { name: 'report.pdf', updatedAt: 1 },
    ]);
    expect(result.current.hasError).toBe(false);
  });

  it('drops a refresh superseded by a newer one', async () => {
    const { result } = renderHook(() =>
      useProjectArtifacts(client, PROJECT_ID),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const first = deferred<ProjectArtifactListResponseDto>();
    client.listProjectArtifacts
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(page('newest.md'));

    let firstRefresh!: Promise<void>;
    act(() => {
      firstRefresh = result.current.refresh();
    });
    const firstSignal = client.listProjectArtifacts.mock.calls[1][1];
    await act(() => result.current.refresh());
    await act(async () => {
      first.resolve(page('stale.md'));
      await firstRefresh;
    });

    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.items.map((item) => item.name)).toEqual([
      'newest.md',
    ]);
  });

  it('aborts the read when the project changes', async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useProjectArtifacts(client, id),
      { initialProps: { id: PROJECT_ID } },
    );
    const firstSignal = client.listProjectArtifacts.mock.calls[0][1];

    rerender({ id: OTHER_ID });

    expect(firstSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(client.listProjectArtifacts).toHaveBeenLastCalledWith(
      OTHER_ID,
      expect.any(AbortSignal),
    );
  });

  it('aborts the read on unmount', () => {
    const { unmount } = renderHook(() =>
      useProjectArtifacts(client, PROJECT_ID),
    );
    const signal = client.listProjectArtifacts.mock.calls[0][1];

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
