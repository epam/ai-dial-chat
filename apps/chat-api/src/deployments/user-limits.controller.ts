import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { UserLimitStatsResponseDto } from '../openapi/openapi-response.dto';
import { DeploymentsService } from './deployments.service';
import { UserStatsQueryDto } from './dto/user-stats-query.dto';

/*
 * Separate from DeploymentsController because it must be mounted at `user`,
 * not `deployments` — the routes proxy DIAL Core's GET /v1/user/limits and
 * GET /v1/user/usage. Reuses DeploymentsService/DeploymentsDetailsService for
 * SDK wiring and error mapping (see openspec/changes/archive/2026-08-18-integrate-sdk-endpoints-update/design.md).
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
      'Returns rate-limit and calendar-period usage statistics for every deployment of the requested ' +
      "kinds visible to the caller, plus the caller's global cost-budget figures. `deploymentTypes` " +
      'selects models and/or applications; when omitted, the server-configured default kinds are ' +
      "reported. A deployment's cost includes the cost of deployments it called, so per-deployment " +
      'cost figures overlap and are not additive. The day, week, and month stats cover ' +
      'the current UTC day, week, and month; each may carry a `resetsAt` instant, which the response ' +
      "forwards verbatim from DIAL Core. Proxies GET /v1/user/limits using the caller's session access " +
      'token. Not cached — every request hits DIAL Core for real-time usage data.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved aggregate user limits',
    type: UserLimitStatsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid `deploymentTypes` value',
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
  getUserLimits(@Req() req: Request, @Query() query: UserStatsQueryDto) {
    const { at } = req.user as SessionUser;
    return this.deploymentsService.getUserLimits(at, query.deploymentTypes);
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
      'verbatim from DIAL Core. `deploymentTypes` selects models and/or applications; when omitted, ' +
      "the server-configured default kinds are reported. A deployment's cost includes the cost of " +
      'deployments it called, so per-deployment cost figures are not additive. ' +
      "Proxies GET /v1/user/usage using the caller's session access token. " +
      'Not cached — every request hits DIAL Core for real-time usage data.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved user usage',
    type: UserLimitStatsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid `deploymentTypes` value',
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
  getUserUsage(@Req() req: Request, @Query() query: UserStatsQueryDto) {
    const { at } = req.user as SessionUser;
    return this.deploymentsService.getUserUsage(at, query.deploymentTypes);
  }
}
