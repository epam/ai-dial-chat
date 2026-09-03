import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  getJobTitleClaim,
  type SessionUser,
} from '../auth/session/session.types';
import { RateMessageDto } from './dto/rate-message.dto';
import { RateService } from './rate.service';

@ApiTags('rate')
@Controller({ path: 'rate', version: '1' })
export class RateController {
  constructor(private readonly rateService: RateService) {}

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Rate an assistant message',
    description:
      'Forwards a like/dislike rating for an assistant message to DIAL Core. ' +
      "Uses the authenticated session's access token as a Bearer credential.",
  })
  @ApiResponse({
    status: 204,
    description: 'Rating accepted — no content returned',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body — missing or invalid fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an unexpected response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or returned a server error',
  })
  async rateMessage(
    @Body() dto: RateMessageDto,
    @Req() req: Request,
  ): Promise<void> {
    const { at, claims } = req.user as SessionUser;
    return this.rateService.rateMessage(dto, at, getJobTitleClaim(claims));
  }
}
