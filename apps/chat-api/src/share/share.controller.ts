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
import { GetInvitationDto } from './dto/get-invitation.dto';
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
      'application, skill, toolset, or model — or conversation) by proxying ' +
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
    const { at, sub } = req.user as SessionUser;
    return this.shareService.acceptInvitation(at, invitationId, sub);
  }
}
