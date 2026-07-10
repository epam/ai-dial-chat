import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareLinkAccess } from '../../../types/share';
import { getShareLink } from '../../../utils/share-link';
import { useShareLink } from '../useShareLink';

vi.mock('../../../utils/share-link', () => ({
  getShareLink: vi.fn(),
}));

describe('useShareLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves share-link data after loading', async () => {
    vi.mocked(getShareLink).mockResolvedValue({
      url: 'https://chat.dialx.ai/marketplace/share/gpt-4o',
      expiresInDays: 3,
      access: ShareLinkAccess.View,
    });

    const { result } = renderHook(() => useShareLink('gpt-4o'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({
      url: 'https://chat.dialx.ai/marketplace/share/gpt-4o',
      expiresInDays: 3,
      access: ShareLinkAccess.View,
    });
    expect(result.current.error).toBeNull();
  });

  it('sets an error when the share link could not be created', async () => {
    vi.mocked(getShareLink).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useShareLink('gpt-4o'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeUndefined();
    expect(result.current.error?.message).toBe('network down');
  });

  it('updates the access level via setAccess', async () => {
    vi.mocked(getShareLink).mockResolvedValue({
      url: 'https://chat.dialx.ai/marketplace/share/gpt-4o',
      expiresInDays: 3,
      access: ShareLinkAccess.View,
    });

    const { result } = renderHook(() => useShareLink('gpt-4o'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setAccess(ShareLinkAccess.Edit);
    });

    expect(result.current.data?.access).toBe(ShareLinkAccess.Edit);
  });

  it('refetches when itemId changes', async () => {
    vi.mocked(getShareLink).mockResolvedValue({
      url: 'https://chat.dialx.ai/marketplace/share/gpt-4o',
      expiresInDays: 3,
      access: ShareLinkAccess.View,
    });

    const { result, rerender } = renderHook(
      ({ itemId }) => useShareLink(itemId),
      { initialProps: { itemId: 'gpt-4o' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(getShareLink).mockResolvedValue({
      url: 'https://chat.dialx.ai/marketplace/share/claude',
      expiresInDays: 3,
      access: ShareLinkAccess.View,
    });
    rerender({ itemId: 'claude' });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.url).toBe(
      'https://chat.dialx.ai/marketplace/share/claude',
    );
  });
});
