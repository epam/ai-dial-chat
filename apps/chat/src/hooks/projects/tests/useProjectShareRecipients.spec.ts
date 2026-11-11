import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShareRecipientsCount } from '../../../server-api/share.api';
import {
  notifyProjectAccessRevoked,
  useProjectShareRecipients,
} from '../useProjectShareRecipients';

vi.mock('../../../server-api/share.api', () => ({
  getShareRecipientsCount: vi.fn(),
}));

describe('useProjectShareRecipients', () => {
  beforeEach(() => vi.resetAllMocks());

  it('hides revoke before and during the initial lookup, then shows it for recipients', async () => {
    let resolve!: (value: { itemId: string; recipientsCount: number }) => void;
    vi.mocked(getShareRecipientsCount).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(useProjectShareRecipients);
    expect(result.current.canRevokeAccess('projects/owner/q4')).toBe(false);
    act(() => result.current.requestRecipients('projects/owner/q4'));
    expect(result.current.canRevokeAccess('projects/owner/q4')).toBe(false);
    await act(async () => {
      resolve({ itemId: 'projects/owner/q4', recipientsCount: 1 });
    });
    expect(result.current.canRevokeAccess('projects/owner/q4')).toBe(true);
  });

  it('hides revoke for zero recipients and offers it again after a new share', async () => {
    vi.mocked(getShareRecipientsCount).mockResolvedValue({
      itemId: 'projects/owner/q4',
      recipientsCount: 0,
    });
    const { result } = renderHook(useProjectShareRecipients);
    act(() => result.current.requestRecipients('projects/owner/q4'));
    await waitFor(() =>
      expect(result.current.canRevokeAccess('projects/owner/q4')).toBe(false),
    );
    vi.mocked(getShareRecipientsCount).mockResolvedValue({
      itemId: 'projects/owner/q4',
      recipientsCount: 2,
    });
    act(() => result.current.requestRecipients('projects/owner/q4'));
    await waitFor(() =>
      expect(result.current.canRevokeAccess('projects/owner/q4')).toBe(true),
    );
    expect(getShareRecipientsCount).toHaveBeenCalledTimes(2);
  });

  it('clears both mounted menus after revoke and ignores a stale lookup', async () => {
    let resolve!: (value: { itemId: string; recipientsCount: number }) => void;
    vi.mocked(getShareRecipientsCount).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result: first } = renderHook(useProjectShareRecipients);
    const { result: second } = renderHook(useProjectShareRecipients);
    act(() => {
      first.current.requestRecipients('projects/owner/q4');
      first.current.requestRecipients('projects/owner/q4');
      notifyProjectAccessRevoked('projects/owner/q4');
    });
    expect(getShareRecipientsCount).toHaveBeenCalledOnce();
    await act(async () => {
      resolve({ itemId: 'projects/owner/q4', recipientsCount: 3 });
    });
    expect(first.current.canRevokeAccess('projects/owner/q4')).toBe(false);
    expect(second.current.canRevokeAccess('projects/owner/q4')).toBe(false);
    expect(second.current.canRevokeAccess('projects/owner/other')).toBe(false);
  });

  it('keeps revoke hidden when the count lookup fails', async () => {
    vi.mocked(getShareRecipientsCount).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(useProjectShareRecipients);
    await act(async () => {
      result.current.requestRecipients('projects/owner/q4');
    });
    expect(result.current.canRevokeAccess('projects/owner/q4')).toBe(false);
  });
});
