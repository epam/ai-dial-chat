import {
  ProjectSource,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revokeSharedAccess } from '../../../server-api/share.api';
import { useProjectRevokeAccess } from '../useProjectRevokeAccess';

const mocks = vi.hoisted(() => ({
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => mocks,
}));
vi.mock('../../../server-api/share.api', () => ({
  revokeSharedAccess: vi.fn(),
  getShareRecipientsCount: vi.fn(async () => ({
    itemId: 'projects/owner/q4',
    recipientsCount: 1,
  })),
}));
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
    expect(revokeSharedAccess).toHaveBeenCalledWith(project.id);
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
});
