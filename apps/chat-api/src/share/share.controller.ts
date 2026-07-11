import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';
import { ShareService } from './share.service';

/** Controller for creating catalog-entity share links. */
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
      'Creates a share link for a catalog entity (agent, application, skill, toolset, ' +
      "or model) by proxying DIAL Core's resource-sharing API. Returns the share URL, " +
      'access level, and expiry.',
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
}
