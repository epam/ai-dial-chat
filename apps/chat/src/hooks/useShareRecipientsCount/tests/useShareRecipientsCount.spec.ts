import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShareRecipientsCount } from '../../../server-api/share.api';
import { RecipientsCountStatus } from '../../../types/share-recipients';
import { useShareRecipientsCount } from '../useShareRecipientsCount';

vi.mock('../../../server-api/share.api', () => ({
  getShareRecipientsCount: vi.fn(),
}));

describe('useShareRecipientsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getShareRecipientsCount).mockResolvedValue({
      itemId: 'conversations/bucket/chat',
      recipientsCount: 3,
    });
  });

  it('reports Idle and issues no request until asked', () => {
    const { result } = renderHook(() => useShareRecipientsCount());

    expect(
      result.current.getRecipientsCount('conversations/bucket/chat').status,
    ).toBe(RecipientsCountStatus.Idle);
    expect(getShareRecipientsCount).not.toHaveBeenCalled();
  });

  it('resolves the count for the requested resource', async () => {
    const { result } = renderHook(() => useShareRecipientsCount());

    act(() => {
      result.current.requestRecipientsCount('conversations/bucket/chat');
    });

    await waitFor(() =>
      expect(
        result.current.getRecipientsCount('conversations/bucket/chat'),
      ).toEqual({ status: RecipientsCountStatus.Resolved, count: 3 }),
    );
    expect(getShareRecipientsCount).toHaveBeenCalledWith(
      'conversations/bucket/chat',
    );
  });

  it('requests a given resource only once', async () => {
    const { result } = renderHook(() => useShareRecipientsCount());

    act(() => {
      result.current.requestRecipientsCount('conversations/bucket/chat');
      result.current.requestRecipientsCount('conversations/bucket/chat');
    });

    await waitFor(() => expect(getShareRecipientsCount).toHaveBeenCalledOnce());
  });

  it('keeps resources independent of one another', async () => {
    vi.mocked(getShareRecipientsCount).mockImplementation((itemId) =>
      Promise.resolve({
        itemId,
        recipientsCount: itemId.endsWith('other') ? 1 : 3,
      }),
    );
    const { result } = renderHook(() => useShareRecipientsCount());

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
    vi.mocked(getShareRecipientsCount).mockRejectedValue(new Error('503'));
    const { result } = renderHook(() => useShareRecipientsCount());

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
    const { result } = renderHook(() => useShareRecipientsCount());

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

    vi.mocked(getShareRecipientsCount).mockResolvedValue({
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
