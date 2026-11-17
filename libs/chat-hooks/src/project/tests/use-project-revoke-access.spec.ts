import {
  ProjectSource,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSharingClient } from '../project-sharing-client';
import { useProjectRevokeAccess as useRevoke } from '../use-project-revoke-access';

const revokeSharedAccess = vi.fn<ProjectSharingClient['revokeSharedAccess']>();
const client: ProjectSharingClient = {
  revokeSharedAccess,
  getShareRecipientsCount: vi.fn(),
};
const mocks = {
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
};
const useProjectRevokeAccess = (
  project: ProjectDetailsDto | null,
  close: () => void,
) =>
  useRevoke(client, project, {
    onRevoked: () => {
      mocks.showSuccessNotification();
      close();
    },
    onError: mocks.showErrorNotification,
  });

const project: ProjectDetailsDto = {
  id: 'projects/owner/q4',
  name: 'q4',
  bucket: 'owner',
  path: 'q4',
  source: ProjectSource.Personal,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"e1"',
  contentVersion: '"cv1"',
  conversationCount: 0,
  canEdit: true,
  canManage: true,
};

describe('useProjectRevokeAccess', () => {
  beforeEach(() => vi.clearAllMocks());
  it('revokes the full project id and closes only after success', async () => {
    vi.mocked(revokeSharedAccess).mockResolvedValue({ success: true });
    const close = vi.fn();
    const { result } = renderHook(() => useProjectRevokeAccess(project, close));
    await act(() => result.current.confirmRevoke());
    expect(revokeSharedAccess).toHaveBeenCalledWith({
      revokeSharedAccessDto: { itemId: project.id },
    });
    expect(close).toHaveBeenCalledOnce();
    expect(mocks.showSuccessNotification).toHaveBeenCalledOnce();
    expect(result.current.isRevoking).toBe(false);
  });
  it('keeps the confirmation available to retry on failure', async () => {
    vi.mocked(revokeSharedAccess).mockRejectedValue(new Error('unavailable'));
    const close = vi.fn();
    const { result } = renderHook(() => useProjectRevokeAccess(project, close));
    await act(() => result.current.confirmRevoke());
    expect(close).not.toHaveBeenCalled();
    expect(mocks.showErrorNotification).toHaveBeenCalledOnce();
    expect(result.current.isRevoking).toBe(false);
    vi.mocked(revokeSharedAccess).mockResolvedValue({ success: true });
    await act(() => result.current.confirmRevoke());
    expect(close).toHaveBeenCalledOnce();
  });
  it('ignores duplicate confirmation while the request is pending', async () => {
    let resolve!: (value: { success: boolean }) => void;
    vi.mocked(revokeSharedAccess).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(() =>
      useProjectRevokeAccess(project, vi.fn()),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.confirmRevoke();
    });
    await act(() => result.current.confirmRevoke());
    expect(revokeSharedAccess).toHaveBeenCalledOnce();
    expect(result.current.isRevoking).toBe(true);
    await act(async () => {
      resolve({ success: true });
      await pending;
    });
  });
  it.each([null, { ...project, canManage: false }])(
    'does not revoke without ownership',
    async (target) => {
      const { result } = renderHook(() =>
        useProjectRevokeAccess(target, vi.fn()),
      );
      await act(() => result.current.confirmRevoke());
      expect(revokeSharedAccess).not.toHaveBeenCalled();
    },
  );
});
