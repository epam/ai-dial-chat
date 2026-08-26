import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getConversationPublishHistory } from '../../../server-api/conversation-publish.api';
import { PublishHistoryStatus } from '../../../types/publish-history';
import { useConversationPublishHistory } from '../useConversationPublishHistory';

vi.mock('../../../server-api/conversation-publish.api', () => ({
  getConversationPublishHistory: vi.fn(),
}));

const PATH = 'my-conversation-abc';

const historyEntry = (folderPath: string) => ({
  path: `conversations/bucket-123/${PATH}`,
  folderPath,
  publishedAt: '2026-08-01T00:00:00.000Z',
  publishedBy: 'user@example.com',
});

describe('useConversationPublishHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getConversationPublishHistory).mockResolvedValue([
      historyEntry('Organization/Shared chats'),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports Idle until a lookup is requested', () => {
    const { result } = renderHook(() => useConversationPublishHistory());

    expect(result.current.getPublishHistory(PATH).status).toBe(
      PublishHistoryStatus.Idle,
    );
    expect(getConversationPublishHistory).not.toHaveBeenCalled();
  });

  it('resolves the published folders for the requested conversation', async () => {
    const { result } = renderHook(() => useConversationPublishHistory());

    act(() => result.current.requestPublishHistory(PATH));

    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).status).toBe(
        PublishHistoryStatus.Resolved,
      ),
    );
    expect(result.current.getPublishHistory(PATH).entries).toEqual([
      {
        publishedAt: Date.parse('2026-08-01T00:00:00.000Z'),
        folderPath: ['Organization', 'Shared chats'],
      },
    ]);
    expect(getConversationPublishHistory).toHaveBeenCalledOnce();
  });

  it('reuses a fresh result, so reopening the same menu issues no second request', async () => {
    const { result } = renderHook(() => useConversationPublishHistory());

    act(() => result.current.requestPublishHistory(PATH));
    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).status).toBe(
        PublishHistoryStatus.Resolved,
      ),
    );
    act(() => result.current.requestPublishHistory(PATH));

    expect(getConversationPublishHistory).toHaveBeenCalledOnce();
  });

  /*
   * GH #8445: whether a conversation is published changes outside this tab —
   * an administrator approving an unpublish request removes the folder
   * server-side. A cache with no expiry went on offering Unpublish for a copy
   * Core had already deleted.
   */
  it('revalidates once the cached result goes stale', async () => {
    const { result } = renderHook(() => useConversationPublishHistory());

    act(() => result.current.requestPublishHistory(PATH));
    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).entries).toHaveLength(1),
    );

    vi.mocked(getConversationPublishHistory).mockResolvedValue([]);
    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1);
    });
    act(() => result.current.requestPublishHistory(PATH));

    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).entries).toEqual([]),
    );
    expect(getConversationPublishHistory).toHaveBeenCalledTimes(2);
  });

  /* Blanking the folders mid-revalidation would blink Unpublish out of an open menu. */
  it('keeps the previous folders on screen while revalidating', async () => {
    const { result } = renderHook(() => useConversationPublishHistory());

    act(() => result.current.requestPublishHistory(PATH));
    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).entries).toHaveLength(1),
    );

    vi.mocked(getConversationPublishHistory).mockReturnValue(
      new Promise(() => undefined),
    );
    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1);
    });
    act(() => result.current.requestPublishHistory(PATH));

    expect(result.current.getPublishHistory(PATH).status).toBe(
      PublishHistoryStatus.Resolved,
    );
    expect(result.current.getPublishHistory(PATH).entries).toHaveLength(1);
  });

  /*
   * The TTL alone stops a repeat inside the window, not one just outside it: a
   * request still running when the window closes would otherwise be joined by
   * a second, and the slower response could land last and overwrite the newer
   * folders.
   */
  it('issues no second request while one is still in flight past the TTL', async () => {
    let settleFirst: (value: never[]) => void = () => undefined;
    vi.mocked(getConversationPublishHistory).mockReturnValueOnce(
      new Promise((resolve) => {
        settleFirst = resolve;
      }),
    );
    const { result } = renderHook(() => useConversationPublishHistory());

    act(() => result.current.requestPublishHistory(PATH));
    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1);
    });
    act(() => result.current.requestPublishHistory(PATH));

    expect(getConversationPublishHistory).toHaveBeenCalledOnce();

    await act(async () => {
      settleFirst([]);
    });

    /* Once it settles the next open revalidates as usual. */
    act(() => result.current.requestPublishHistory(PATH));
    await waitFor(() =>
      expect(getConversationPublishHistory).toHaveBeenCalledTimes(2),
    );
  });

  it('releases the in-flight lock when the lookup fails', async () => {
    vi.mocked(getConversationPublishHistory).mockRejectedValue(
      new Error('boom'),
    );
    const { result } = renderHook(() => useConversationPublishHistory());

    act(() => result.current.requestPublishHistory(PATH));
    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).status).toBe(
        PublishHistoryStatus.Failed,
      ),
    );

    act(() => result.current.requestPublishHistory(PATH));

    expect(getConversationPublishHistory).toHaveBeenCalledTimes(2);
  });

  it('marks the lookup Failed and retries on the next request', async () => {
    vi.mocked(getConversationPublishHistory).mockRejectedValue(
      new Error('boom'),
    );
    const { result } = renderHook(() => useConversationPublishHistory());

    act(() => result.current.requestPublishHistory(PATH));
    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).status).toBe(
        PublishHistoryStatus.Failed,
      ),
    );

    vi.mocked(getConversationPublishHistory).mockResolvedValue([
      historyEntry('Organization/Reports'),
    ]);
    act(() => result.current.requestPublishHistory(PATH));

    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).status).toBe(
        PublishHistoryStatus.Resolved,
      ),
    );
    expect(getConversationPublishHistory).toHaveBeenCalledTimes(2);
  });

  it('tracks each conversation separately', async () => {
    const { result } = renderHook(() => useConversationPublishHistory());

    act(() => result.current.requestPublishHistory(PATH));
    await waitFor(() =>
      expect(result.current.getPublishHistory(PATH).status).toBe(
        PublishHistoryStatus.Resolved,
      ),
    );

    expect(result.current.getPublishHistory('other-conversation').status).toBe(
      PublishHistoryStatus.Idle,
    );
  });
});
