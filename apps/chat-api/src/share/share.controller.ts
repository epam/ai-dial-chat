import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { AcceptInvitationResponseDto } from './dto/accept-invitation-response.dto';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import {
  DiscardSharedCatalogItemDto,
  DiscardSharedCatalogItemResponseDto,
} from './dto/discard-shared-catalog-item.dto';
import { GetInvitationDto } from './dto/get-invitation.dto';
import {
  RevokeSharedAccessDto,
  RevokeSharedAccessResponseDto,
} from './dto/revoke-shared-access.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';
import { ShareService } from './share.service';

/** Controller for creating share links for DIAL Core resources. */
@ApiTags('share')
@Controller({ path: 'share', version: '1' })
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    operationId: 'createShareLink',
    summary: 'Create a share link',
    description:
      'Creates a share link for a DIAL Core resource (catalog entity — agent, ' +
      'application, skill, toolset, or model — conversation, or prompt) by proxying ' +
      "DIAL Core's resource-sharing API. Returns the share URL, access level, " +
      'and expiry.',
  })
  @ApiBody({ type: CreateShareLinkDto })
  @ApiResponse({
    status: 201,
    description: 'Share link created successfully',
    type: ShareLinkResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid itemId or access value',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  createShareLink(
    @Req() req: Request,
    @Body() body: CreateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    const { at } = req.user as SessionUser;
    return this.shareService.createShareLink(at, body);
  }

  @Get('invitations/:invitationId')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    operationId: 'acceptInvitation',
    summary: 'Accept a share invitation',
    description:
      "Accepts a share invitation via DIAL Core, granting the authenticated user the invitation's " +
      "access level, and returns the shared entity's identifier so the frontend can navigate to it.",
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted',
    type: AcceptInvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid invitationId',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found, expired, or already revoked',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  acceptInvitation(
    @Req() req: Request,
    @Param() { invitationId }: GetInvitationDto,
  ): Promise<AcceptInvitationResponseDto> {
    const { at, sub, bucket } = req.user as SessionUser;
    return this.shareService.acceptInvitation(at, invitationId, sub, bucket);
  }

  @Post('discard')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'discardSharedCatalogItem',
    summary: 'Discard a shared catalog resource or conversation',
    description:
      "Discards the authenticated user's own access to a shared catalog " +
      "entity (application or toolset) or conversation, via DIAL Core's " +
      "discardSharedResources operation. Only affects the caller's own " +
      'access — removing access for everyone else is a separate operation.',
  })
  @ApiBody({ type: DiscardSharedCatalogItemDto })
  @ApiResponse({
    status: 200,
    description: 'Resource discarded successfully',
    type: DiscardSharedCatalogItemResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid itemId',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Resource is not shared with the caller',
  })
  @ApiResponse({ status: 404, description: 'Resource does not exist' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  discardSharedCatalogItem(
    @Req() req: Request,
    @Body() body: DiscardSharedCatalogItemDto,
  ): Promise<DiscardSharedCatalogItemResponseDto> {
    const { at, sub } = req.user as SessionUser;
    return this.shareService.discardShared(body.itemId, at, sub);
  }

  @Post('revoke')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'revokeSharedAccess',
    summary: 'Revoke all shared access to an owned resource',
    description:
      "Revokes every outstanding share grant on a catalog entity (application or toolset) or conversation the caller owns, via DIAL Core's " +
      'revokeSharedResources operation. Affects all recipients at once — DIAL Core cannot target a single recipient. Discarding only the ' +
      "caller's own access to a resource shared with them is a separate operation.",
  })
  @ApiBody({ type: RevokeSharedAccessDto })
  @ApiResponse({
    status: 200,
    description: 'Shared access revoked successfully',
    type: RevokeSharedAccessResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid itemId',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller does not own the resource',
  })
  @ApiResponse({ status: 404, description: 'Resource does not exist' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  revokeSharedAccess(
    @Req() req: Request,
    @Body() body: RevokeSharedAccessDto,
  ): Promise<RevokeSharedAccessResponseDto> {
    const { at, sub } = req.user as SessionUser;
    return this.shareService.revokeShared(body.itemId, at, sub);
  }
}
