import type {
  AcceptInvitationResponseDto,
  CreateShareLinkDto,
  ShareLinkResponseDto,
} from '@epam/chat-api-client';
import { shareApi } from './api-client';

export const createShareLink = (
  body: CreateShareLinkDto,
): Promise<ShareLinkResponseDto> =>
  shareApi.createShareLink({ createShareLinkDto: body });

export const acceptInvitation = (
  invitationId: string,
): Promise<AcceptInvitationResponseDto> =>
  shareApi.acceptInvitation({ invitationId });
