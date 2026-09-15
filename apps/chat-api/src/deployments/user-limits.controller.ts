import { Controller, Get, Header, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { UserLimitStatsResponseDto } from '../openapi/openapi-response.dto';
import { DeploymentsService } from './deployments.service';

/*
 * Separate from DeploymentsController because it must be mounted at `user`,
 * not `deployments` — the routes proxy DIAL Core's GET /v1/user/limits and
 * GET /v1/user/usage. Reuses DeploymentsService/DeploymentsDetailsService for
 * SDK wiring and error mapping (see openspec/changes/integrate-sdk-endpoints-update/design.md).
 */
@ApiTags('user')
@Controller({ path: 'user', version: '1' })
export class UserLimitsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get('limits')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getUserLimits',
    summary: 'Get aggregate usage limits for every visible deployment',
    description:
      'Returns rate-limit and calendar-period usage statistics for every model deployment visible to ' +
      "the caller, plus the caller's global cost-budget figures. The day, week, and month stats cover " +
      'the current UTC day, week, and month; each may carry a `resetsAt` instant, which the response ' +
      "forwards verbatim from DIAL Core. Proxies GET /v1/user/limits using the caller's session access " +
      'token. Not cached — every request hits DIAL Core for real-time usage data.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved aggregate user limits',
    type: UserLimitStatsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getUserLimits(@Req() req: Request) {
    const { at } = req.user as SessionUser;
    return this.deploymentsService.getUserLimits(at);
  }

  @Get('usage')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getUserUsage',
    summary:
      'Get usage limits for deployments used in the current calendar periods',
    description:
      'Returns the same shape as GET /user/limits, restricted to deployments the caller actually ' +
      'used within the currently reported calendar periods (the current UTC day, week, and month). ' +
      'Each day, week, and month stat may carry a `resetsAt` instant, which the response forwards ' +
      "verbatim from DIAL Core. Proxies GET /v1/user/usage using the caller's session access token. " +
      'Not cached — every request hits DIAL Core for real-time usage data.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved user usage',
    type: UserLimitStatsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getUserUsage(@Req() req: Request) {
    const { at } = req.user as SessionUser;
    return this.deploymentsService.getUserUsage(at);
  }
}
