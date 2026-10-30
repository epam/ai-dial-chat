import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteProjectConversation,
  listProjectConversations,
  renameProjectConversation,
} from '../../../server-api/project-conversations.api';
import { useProjectConversations } from '../useProjectConversations';

vi.mock('../../../server-api/project-conversations.api', () => ({
  listProjectConversations: vi.fn(),
  renameProjectConversation: vi.fn(),
  deleteProjectConversation: vi.fn(),
}));

const PROJECT_ID = 'projects/a1b2c3/q4';
const listing = {
  items: [
    { id: 'c1', name: 'n1', title: 'First', author: 'Valery Tester' },
    { id: 'c2', name: 'n2', title: 'Second' },
  ],
  hasMore: false,
};

describe('useProjectConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProjectConversations).mockResolvedValue(listing);
  });

  it('loads and maps the conversations', async () => {
    const { result } = renderHook(() => useProjectConversations(PROJECT_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([
      { id: 'c1', title: 'First', authorName: 'Valery Tester' },
      { id: 'c2', title: 'Second', authorName: undefined },
    ]);
    expect(listProjectConversations).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.any(AbortSignal),
    );
  });

  it('reports a failure and reloads on retry', async () => {
    vi.mocked(listProjectConversations).mockRejectedValueOnce(new Error('x'));
    const { result } = renderHook(() => useProjectConversations(PROJECT_ID));

    await waitFor(() => expect(result.current.hasError).toBe(true));
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasError).toBe(false);
  });

  it('renames and removes rows in place', async () => {
    vi.mocked(renameProjectConversation).mockResolvedValue({ name: 'Renamed' });
    vi.mocked(deleteProjectConversation).mockResolvedValue(undefined);
    const { result } = renderHook(() => useProjectConversations(PROJECT_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.rename('c1', 'Renamed'));
    await act(() => result.current.remove('c2'));

    expect(result.current.items).toEqual([
      { id: 'c1', title: 'Renamed', authorName: 'Valery Tester' },
    ]);
  });

  it('aborts the request when the view unmounts', () => {
    const { unmount } = renderHook(() => useProjectConversations(PROJECT_ID));
    const [, signal] = vi.mocked(listProjectConversations).mock.calls[0];

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('loads nothing without a project', () => {
    renderHook(() => useProjectConversations(null));

    expect(listProjectConversations).not.toHaveBeenCalled();
  });
});
