import type {
  AcceptInvitationResponseDto,
  DiscardSharedCatalogItemResponseDto,
  RevokeSharedAccessResponseDto,
  ShareRecipientsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { shareApi } from './api-client';

export const acceptInvitation = (
  invitationId: string,
): Promise<AcceptInvitationResponseDto> =>
  shareApi.acceptInvitation({ invitationId });

export const discardSharedCatalogItem = (
  itemId: string,
): Promise<DiscardSharedCatalogItemResponseDto> =>
  shareApi.discardSharedCatalogItem({
    discardSharedCatalogItemDto: { itemId },
  });

export const revokeSharedAccess = (
  itemId: string,
): Promise<RevokeSharedAccessResponseDto> =>
  shareApi.revokeSharedAccess({
    revokeSharedAccessDto: { itemId },
  });

export const getShareRecipientsCount = (
  itemId: string,
): Promise<ShareRecipientsResponseDto> =>
  shareApi.getShareRecipientsCount({ itemId });
