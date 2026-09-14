import { Injectable } from '@nestjs/common';
import { AcceptInvitationResponseDto } from './dto/accept-invitation-response.dto';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { DiscardSharedCatalogItemResponseDto } from './dto/discard-shared-catalog-item.dto';
import { RevokeSharedAccessResponseDto } from './dto/revoke-shared-access.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';
import { ShareRecipientsResponseDto } from './dto/share-recipients.dto';
import { ShareInvitationService } from './invitation/share-invitation.service';
import { ShareManagementService } from './management/share-management.service';

/** Facade over share-invitation and share-management operations for DIAL Core resources (catalog entities, prompts, or conversations). */
@Injectable()
export class ShareService {
  constructor(
    private readonly shareInvitationService: ShareInvitationService,
    private readonly shareManagementService: ShareManagementService,
  ) {}

  createShareLink(
    accessToken: string,
    bucket: string,
    dto: CreateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    return this.shareInvitationService.createShareLink(
      accessToken,
      bucket,
      dto,
    );
  }

  acceptInvitation(
    accessToken: string,
    invitationId: string,
    userSub: string,
    bucket: string,
  ): Promise<AcceptInvitationResponseDto> {
    return this.shareInvitationService.acceptInvitation(
      accessToken,
      invitationId,
      userSub,
      bucket,
    );
  }

  discardShared(
    itemId: string,
    accessToken: string,
    userSub: string,
  ): Promise<DiscardSharedCatalogItemResponseDto> {
    return this.shareManagementService.discardShared(
      itemId,
      accessToken,
      userSub,
    );
  }

  getRecipientsCount(
    itemId: string,
    accessToken: string,
  ): Promise<ShareRecipientsResponseDto> {
    return this.shareManagementService.getRecipientsCount(itemId, accessToken);
  }

  revokeShared(
    itemId: string,
    accessToken: string,
    userSub: string,
  ): Promise<RevokeSharedAccessResponseDto> {
    return this.shareManagementService.revokeShared(
      itemId,
      accessToken,
      userSub,
    );
  }
}
