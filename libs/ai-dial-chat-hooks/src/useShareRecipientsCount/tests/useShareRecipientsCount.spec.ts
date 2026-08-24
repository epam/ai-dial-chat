import type { ShareApi } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RecipientsCountStatus,
  useShareRecipientsCount,
} from '../useShareRecipientsCount';

const getShareRecipientsCount = vi.fn();
const fakeShareApi = { getShareRecipientsCount } as unknown as Pick<
  ShareApi,
  'getShareRecipientsCount'
>;

describe('useShareRecipientsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getShareRecipientsCount.mockResolvedValue({
      itemId: 'conversations/bucket/chat',
      recipientsCount: 3,
    });
  });

  it('reports Idle and issues no request until asked', () => {
    const { result } = renderHook(() => useShareRecipientsCount(fakeShareApi));

    expect(
      result.current.getRecipientsCount('conversations/bucket/chat').status,
    ).toBe(RecipientsCountStatus.Idle);
    expect(getShareRecipientsCount).not.toHaveBeenCalled();
  });

  it('resolves the count for the requested resource', async () => {
    const { result } = renderHook(() => useShareRecipientsCount(fakeShareApi));

    act(() => {
      result.current.requestRecipientsCount('conversations/bucket/chat');
    });

    await waitFor(() =>
      expect(
        result.current.getRecipientsCount('conversations/bucket/chat'),
      ).toEqual({ status: RecipientsCountStatus.Resolved, count: 3 }),
    );
    expect(getShareRecipientsCount).toHaveBeenCalledWith({
      itemId: 'conversations/bucket/chat',
    });
  });

  it('requests a given resource only once', async () => {
    const { result } = renderHook(() => useShareRecipientsCount(fakeShareApi));

    act(() => {
      result.current.requestRecipientsCount('conversations/bucket/chat');
      result.current.requestRecipientsCount('conversations/bucket/chat');
    });

    await waitFor(() => expect(getShareRecipientsCount).toHaveBeenCalledOnce());
  });

  it('keeps resources independent of one another', async () => {
    getShareRecipientsCount.mockImplementation(({ itemId }) =>
      Promise.resolve({
        itemId,
        recipientsCount: itemId.endsWith('other') ? 1 : 3,
      }),
    );
    const { result } = renderHook(() => useShareRecipientsCount(fakeShareApi));

    act(() => {
      result.current.requestRecipientsCount('conversations/bucket/chat');
      result.current.requestRecipientsCount('conversations/bucket/other');
    });

    await waitFor(() => {
      expect(
        result.current.getRecipientsCount('conversations/bucket/chat').count,
      ).toBe(3);
      expect(
        result.current.getRecipientsCount('conversations/bucket/other').count,
      ).toBe(1);
    });
  });

  it('reports Unknown when the lookup fails', async () => {
    getShareRecipientsCount.mockRejectedValue(new Error('503'));
    const { result } = renderHook(() => useShareRecipientsCount(fakeShareApi));

    act(() => {
      result.current.requestRecipientsCount('conversations/bucket/chat');
    });

    await waitFor(() =>
      expect(
        result.current.getRecipientsCount('conversations/bucket/chat').status,
      ).toBe(RecipientsCountStatus.Unknown),
    );
  });

  it('re-fetches a resource after its count is invalidated', async () => {
    const { result } = renderHook(() => useShareRecipientsCount(fakeShareApi));

    act(() => {
      result.current.requestRecipientsCount('conversations/bucket/chat');
    });
    await waitFor(() =>
      expect(
        result.current.getRecipientsCount('conversations/bucket/chat').count,
      ).toBe(3),
    );

    act(() => {
      result.current.invalidateRecipientsCount('conversations/bucket/chat');
    });
    expect(
      result.current.getRecipientsCount('conversations/bucket/chat').status,
    ).toBe(RecipientsCountStatus.Idle);

    getShareRecipientsCount.mockResolvedValue({
      itemId: 'conversations/bucket/chat',
      recipientsCount: 0,
    });
    act(() => {
      result.current.requestRecipientsCount('conversations/bucket/chat');
    });

    await waitFor(() =>
      expect(
        result.current.getRecipientsCount('conversations/bucket/chat').count,
      ).toBe(0),
    );
    expect(getShareRecipientsCount).toHaveBeenCalledTimes(2);
  });
});
