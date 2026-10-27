import { ProjectSource as ProjectSourceDto } from '@epam/ai-dial-chat-api-client';
import { ProjectSource } from '@epam/ai-dial-projects';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listProjects } from '../../../server-api/projects.api';
import { useProjects } from '../useProjects';

vi.mock('../../../server-api/projects.api', () => ({
  listProjects: vi.fn(),
}));

const listing = {
  items: [
    {
      id: 'projects/b/alpha',
      name: 'alpha',
      bucket: 'b',
      path: 'alpha',
      source: ProjectSourceDto.Shared,
      updatedAt: 5,
    },
  ],
  incompleteSources: [ProjectSourceDto.Organization],
};

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and maps the projects and their incomplete sources', async () => {
    vi.mocked(listProjects).mockResolvedValue(listing);

    const { result } = renderHook(() => useProjects(true));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasError).toBe(false);
    expect(result.current.projects).toEqual([
      {
        id: 'projects/b/alpha',
        name: 'alpha',
        source: ProjectSource.Shared,
        updatedAt: 5,
      },
    ]);
    expect(result.current.incompleteSources).toEqual([
      ProjectSource.Organization,
    ]);
  });

  it('sends no request while disabled', () => {
    const { result } = renderHook(() => useProjects(false));

    expect(listProjects).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  /* A direct load of /projects starts disabled until the app config is ready;
   * the first enabled render must already be loading, never the empty list. */
  it('is loading on the very first render after being enabled', () => {
    const pending = deferred<typeof listing>();
    vi.mocked(listProjects).mockReturnValue(pending.promise);
    const renders: Array<{ isLoading: boolean; enabled: boolean }> = [];

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => {
        const state = useProjects(enabled);
        renders.push({ isLoading: state.isLoading, enabled });
        return state;
      },
      { initialProps: { enabled: false } },
    );
    rerender({ enabled: true });

    expect(
      renders
        .filter(({ enabled }) => enabled)
        .every(({ isLoading }) => isLoading),
    ).toBe(true);
    expect(listProjects).toHaveBeenCalledOnce();
  });

  it('reports an error and is loading again as soon as retry is called', async () => {
    const second = deferred<typeof listing>();
    vi.mocked(listProjects)
      .mockRejectedValueOnce(new Error('Bad gateway'))
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useProjects(true));

    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.projects).toEqual([]);

    act(() => result.current.retry());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    await act(async () => second.resolve(listing));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.projects).toHaveLength(1);
    expect(listProjects).toHaveBeenCalledTimes(2);
  });

  it('aborts the pending request when disabled and ignores its late result', async () => {
    const pending = deferred<typeof listing>();
    vi.mocked(listProjects).mockReturnValue(pending.promise);

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useProjects(enabled),
      { initialProps: { enabled: true } },
    );
    const { signal } = vi.mocked(listProjects).mock.calls[0][0] ?? {};

    rerender({ enabled: false });
    await act(async () => pending.resolve(listing));

    expect(signal?.aborted).toBe(true);
    expect(result.current.projects).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('aborts the pending request on unmount', () => {
    vi.mocked(listProjects).mockReturnValue(deferred<typeof listing>().promise);

    const { unmount } = renderHook(() => useProjects(true));
    const { signal } = vi.mocked(listProjects).mock.calls[0][0] ?? {};
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
