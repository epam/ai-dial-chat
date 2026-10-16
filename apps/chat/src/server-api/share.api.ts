import {
  ResponseError,
  type AcceptInvitationErrorDto,
  type AcceptInvitationResponseDto,
  type DiscardSharedCatalogItemResponseDto,
  type RevokeSharedAccessResponseDto,
  type ShareRecipientsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { shareApi } from './api-client';

export const acceptInvitation = (
  invitationId: string,
): Promise<AcceptInvitationResponseDto> =>
  shareApi.acceptInvitation({ invitationId });

/** Shared item's title carried by a refused `acceptInvitation` error, when the backend sent one. */
export const getAcceptInvitationErrorItemName = async (
  error: unknown,
): Promise<string | undefined> => {
  if (!(error instanceof ResponseError)) return undefined;
  try {
    const body = (await error.response
      .clone()
      .json()) as Partial<AcceptInvitationErrorDto>;
    return typeof body.itemName === 'string' && body.itemName
      ? body.itemName
      : undefined;
  } catch {
    return undefined;
  }
};

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
