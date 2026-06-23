import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { OptionalSessionGuard } from '../auth/session/optional-session.guard';
import type { SessionUser } from '../auth/session/session.types';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from './app-config.service';
import type { AppConfigEvalContext } from './app-config.types';
import type { ClientConfigResponseDto } from './dto/client-config-response.dto';
import { ClientConfigResponseDto as ClientConfigResponseDtoClass } from './dto/client-config-response.dto';
import { GetClientConfigDto } from './dto/get-client-config.dto';

/**
 * Client config is cached by app ID, user ID, and sorted roles in AppConfigService
 * so role-restricted values cannot leak across users.
 */
@ApiTags('app-config')
@Controller({ path: 'client-config', version: '1' })
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @Public()
  @UseGuards(OptionalSessionGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get client-safe application configuration and feature flags',
  })
  @ApiResponse({ status: 200, type: ClientConfigResponseDtoClass })
  @ApiResponse({ status: 400, description: 'Missing or invalid appId' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async getClientConfig(
    @Query() query: GetClientConfigDto,
    @Req() req: Request,
  ): Promise<ClientConfigResponseDto> {
    const sessionUser = req.user as SessionUser | undefined;
    const context: AppConfigEvalContext = {
      appId: query.appId,
      userId: sessionUser?.sub,
      roles: extractRoles(sessionUser?.claims),
      environment: process.env['NODE_ENV'],
    };
    return this.appConfigService.getClientConfig(context);
  }
}

function extractRoles(
  claims: Record<string, unknown> | undefined,
): string[] | undefined {
  if (!claims) return undefined;
  const roles = claims['roles'];
  if (Array.isArray(roles))
    return roles.filter((r): r is string => typeof r === 'string');
  return undefined;
}
