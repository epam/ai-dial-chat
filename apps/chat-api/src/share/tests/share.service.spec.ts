import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareInvitationService } from '../invitation/share-invitation.service';
import type { ShareManagementService } from '../management/share-management.service';
import { ShareService } from '../share.service';

function makeService() {
  const shareInvitationService = {
    createShareLink: vi.fn().mockResolvedValue('create-share-link-result'),
    acceptInvitation: vi.fn().mockResolvedValue('accept-invitation-result'),
  } as unknown as ShareInvitationService;

  const shareManagementService = {
    discardShared: vi.fn().mockResolvedValue('discard-shared-result'),
    getRecipientsCount: vi
      .fn()
      .mockResolvedValue('get-recipients-count-result'),
    revokeShared: vi.fn().mockResolvedValue('revoke-shared-result'),
  } as unknown as ShareManagementService;

  const service = new ShareService(
    shareInvitationService,
    shareManagementService,
  );
  return { service, shareInvitationService, shareManagementService };
}

describe('ShareService (facade)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates createShareLink to ShareInvitationService', async () => {
    const { service, shareInvitationService } = makeService();
    const dto = { itemId: 'gpt-4o', access: [] } as never;

    const result = await service.createShareLink('token', 'bucket', dto);

    expect(shareInvitationService.createShareLink).toHaveBeenCalledWith(
      'token',
      'bucket',
      dto,
    );
    expect(result).toBe('create-share-link-result');
  });

  it('delegates acceptInvitation to ShareInvitationService', async () => {
    const { service, shareInvitationService } = makeService();

    const result = await service.acceptInvitation(
      'token',
      'invitation-id',
      'user-sub',
      'bucket',
    );

    expect(shareInvitationService.acceptInvitation).toHaveBeenCalledWith(
      'token',
      'invitation-id',
      'user-sub',
      'bucket',
    );
    expect(result).toBe('accept-invitation-result');
  });

  it('delegates discardShared to ShareManagementService', async () => {
    const { service, shareManagementService } = makeService();

    const result = await service.discardShared('item-id', 'token', 'user-sub');

    expect(shareManagementService.discardShared).toHaveBeenCalledWith(
      'item-id',
      'token',
      'user-sub',
    );
    expect(result).toBe('discard-shared-result');
  });

  it('delegates getRecipientsCount to ShareManagementService', async () => {
    const { service, shareManagementService } = makeService();

    const result = await service.getRecipientsCount('item-id', 'token');

    expect(shareManagementService.getRecipientsCount).toHaveBeenCalledWith(
      'item-id',
      'token',
    );
    expect(result).toBe('get-recipients-count-result');
  });

  it('delegates revokeShared to ShareManagementService', async () => {
    const { service, shareManagementService } = makeService();

    const result = await service.revokeShared('item-id', 'token', 'user-sub');

    expect(shareManagementService.revokeShared).toHaveBeenCalledWith(
      'item-id',
      'token',
      'user-sub',
    );
    expect(result).toBe('revoke-shared-result');
  });
});
