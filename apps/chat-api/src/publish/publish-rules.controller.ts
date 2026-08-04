import { Controller, Get, HttpCode, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { GetPublishRulesQueryDto } from './dto/get-publish-rules-query.dto';
import { PublishRulesResultDto } from './dto/publish-rules-result.dto';
import { PublishRulesService } from './publish-rules.service';

/** Controller for reading a destination folder's already-configured DIAL Core publication rules, shared by the conversation and catalog publish flows. */
@ApiTags('publish')
@Controller({ path: 'publish', version: '1' })
export class PublishRulesController {
  constructor(private readonly publishRulesService: PublishRulesService) {}

  @Get('rules')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'getPublishRules',
    summary: "Get a destination folder's already-configured access rules",
    description:
      "Returns the exact requested folder's own access-restriction rules by proxying DIAL Core's " +
      '`getPublicationRules` — ancestor-folder rules in the underlying response are discarded, never returned.',
  })
  @ApiResponse({
    status: 200,
    description: "The folder's own rules, or an empty array when it has none",
    type: PublishRulesResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid folderPath',
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
  async getRules(
    @Req() req: Request,
    @Query() { folderPath }: GetPublishRulesQueryDto,
  ): Promise<PublishRulesResultDto> {
    const { at } = req.user as SessionUser;
    const rules = await this.publishRulesService.getRules(at, folderPath);
    return { rules };
  }
}
