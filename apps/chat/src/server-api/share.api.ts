import type {
  AcceptInvitationResponseDto,
  CreateShareLinkDto,
  DiscardSharedCatalogItemResponseDto,
  ShareLinkResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { shareApi } from './api-client';

export const createShareLink = (
  body: CreateShareLinkDto,
): Promise<ShareLinkResponseDto> =>
  shareApi.createShareLink({ createShareLinkDto: body });

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
