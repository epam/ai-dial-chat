import { ProjectSource } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProject } from '../../../server-api/projects.api';
import { useProject } from '../useProject';

vi.mock('../../../server-api/projects.api', () => ({
  getProject: vi.fn(),
}));

const details = {
  id: 'projects/b/q4',
  name: 'q4',
  bucket: 'b',
  path: 'q4',
  source: ProjectSource.Personal,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"e1"',
  contentVersion: '"cv1"',
  conversationCount: 0,
  canEdit: true,
};

const httpError = (status: number) => ({
  response: new Response(null, { status }),
});

describe('useProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the project and stops loading', async () => {
    vi.mocked(getProject).mockResolvedValue(details);

    const { result } = renderHook(() => useProject('projects/b/q4', true));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.project).toEqual(details));
    expect(result.current.isLoading).toBe(false);
    expect(getProject).toHaveBeenCalledWith('projects/b/q4', {
      signal: expect.any(AbortSignal),
    });
  });

  it('reports a 404 as not found rather than an error', async () => {
    vi.mocked(getProject).mockRejectedValue(httpError(404));

    const { result } = renderHook(() => useProject('projects/b/q4', true));

    await waitFor(() => expect(result.current.isNotFound).toBe(true));
    expect(result.current.hasError).toBe(false);
  });

  it('reports other failures as an error and refetches on retry', async () => {
    vi.mocked(getProject)
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(details);

    const { result } = renderHook(() => useProject('projects/b/q4', true));

    await waitFor(() => expect(result.current.hasError).toBe(true));
    act(() => result.current.retry());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.project).toEqual(details));
    expect(getProject).toHaveBeenCalledTimes(2);
  });

  it('sends no request while disabled or without an id', () => {
    const { result, rerender } = renderHook(
      ({ id, enabled }) => useProject(id, enabled),
      { initialProps: { id: null as string | null, enabled: true } },
    );
    expect(result.current.isLoading).toBe(false);

    rerender({ id: 'projects/b/q4', enabled: false });

    expect(result.current.isLoading).toBe(false);
    expect(getProject).not.toHaveBeenCalled();
  });

  it('aborts the request on unmount', async () => {
    vi.mocked(getProject).mockReturnValue(new Promise(() => undefined));

    const { unmount } = renderHook(() => useProject('projects/b/q4', true));
    const { signal } = vi.mocked(getProject).mock.calls[0][1] as {
      signal: AbortSignal;
    };
    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('does not return the previous project while a new id loads', async () => {
    vi.mocked(getProject).mockResolvedValueOnce(details);

    const { result, rerender } = renderHook(({ id }) => useProject(id, true), {
      initialProps: { id: 'projects/b/q4' },
    });
    await waitFor(() => expect(result.current.project).toEqual(details));

    vi.mocked(getProject).mockReturnValue(new Promise(() => undefined));
    rerender({ id: 'projects/b/other' });

    expect(result.current.project).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });
});
