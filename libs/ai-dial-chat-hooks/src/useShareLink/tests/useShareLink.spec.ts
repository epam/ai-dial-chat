import type { ShareApi } from '@epam/ai-dial-chat-api-client';
import { ShareLinkResponseDtoAccessEnum } from '@epam/ai-dial-chat-api-client';
import { ShareLinkAccess } from '@epam/ai-dial-share';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useShareLink } from '../useShareLink';

const createShareLink = vi.fn();
const fakeShareApi = { createShareLink } as unknown as Pick<
  ShareApi,
  'createShareLink'
>;

const ORIGIN = 'https://example.com';

describe('useShareLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves share-link data after loading', async () => {
    createShareLink.mockResolvedValue({
      url: '/marketplace/share/gpt-4o',
      expiresInDays: 3,
      access: [ShareLinkResponseDtoAccessEnum.View],
    });

    const { result } = renderHook(() =>
      useShareLink(fakeShareApi, 'gpt-4o', undefined, ORIGIN),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({
      url: 'https://example.com/marketplace/share/gpt-4o',
      expiresInDays: 3,
      access: [ShareLinkAccess.View],
    });
    expect(result.current.error).toBeNull();
  });

  it('sets an error when the share link could not be created', async () => {
    createShareLink.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() =>
      useShareLink(fakeShareApi, 'gpt-4o', undefined, ORIGIN),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeUndefined();
    expect(result.current.error?.message).toBe('network down');
  });

  it('requests a new share link with the new access via setAccess', async () => {
    createShareLink.mockResolvedValue({
      url: '/marketplace/share/gpt-4o?access=view',
      expiresInDays: 3,
      access: [ShareLinkResponseDtoAccessEnum.View],
    });

    const { result } = renderHook(() =>
      useShareLink(fakeShareApi, 'gpt-4o', undefined, ORIGIN),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    createShareLink.mockResolvedValue({
      url: '/marketplace/share/gpt-4o?access=edit',
      expiresInDays: 3,
      access: [
        ShareLinkResponseDtoAccessEnum.View,
        ShareLinkResponseDtoAccessEnum.Edit,
      ],
    });

    act(() => {
      result.current.setAccess([ShareLinkAccess.View, ShareLinkAccess.Edit]);
    });

    expect(result.current.isLoading).toBe(true);
    expect(createShareLink).toHaveBeenCalledWith({
      createShareLinkDto: {
        itemId: 'gpt-4o',
        resourceKind: undefined,
        access: [ShareLinkAccess.View, ShareLinkAccess.Edit],
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.url).toBe(
      'https://example.com/marketplace/share/gpt-4o?access=edit',
    );
    expect(result.current.data?.access).toEqual([
      ShareLinkAccess.View,
      ShareLinkAccess.Edit,
    ]);
  });

  it('refetches when itemId changes', async () => {
    createShareLink.mockResolvedValue({
      url: '/marketplace/share/gpt-4o',
      expiresInDays: 3,
      access: [ShareLinkResponseDtoAccessEnum.View],
    });

    const { result, rerender } = renderHook(
      ({ itemId }) => useShareLink(fakeShareApi, itemId, undefined, ORIGIN),
      { initialProps: { itemId: 'gpt-4o' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    createShareLink.mockResolvedValue({
      url: '/marketplace/share/claude',
      expiresInDays: 3,
      access: [ShareLinkResponseDtoAccessEnum.View],
    });
    rerender({ itemId: 'claude' });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.url).toBe(
      'https://example.com/marketplace/share/claude',
    );
  });
});
