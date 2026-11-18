import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { GetUserUsageHistoryQueryDto } from './dto/get-user-usage-history-query.dto';
import { UserUsageHistoryResponseDto } from './dto/user-usage-history-response.dto';
import { UsageHistoryService } from './usage-history.service';

/*
 * Mounted at `user` beside UserLimitsController, which proxies DIAL Core's
 * live counters; this route reads history from DIAL Analytics (ADAS) instead,
 * so it lives in its own domain (see
 * openspec/changes/add-user-usage-history-api/design.md).
 */
@ApiTags('user')
@Controller({ path: 'user', version: '1' })
export class UserUsageHistoryController {
  constructor(private readonly usageHistoryService: UsageHistoryService) {}

  @Get('usage/history')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      "Get the caller's own usage history for the current UTC day, week or month",
    description:
      "Returns the signed-in user's spend and request counts from DIAL Analytics (ADAS) for the " +
      'current UTC day, ISO week (Monday start) or month, from its start to the request time: ' +
      'totals, one zero-filled entry per UTC date, the top 10 root deployments by spend plus an ' +
      '`other` remainder, and the split by client type when the `usage_client_identity` ' +
      'enrichment is available. Each user request counts once (root spans only), with its ' +
      "chain-inclusive price. The BFF forwards the caller's session access token to ADAS, whose " +
      'row policy confines the rows to the caller; a caller whose ADAS view is not ' +
      'row-restricted gets `forbidden`. When ADAS cannot answer, the response is still `200`, ' +
      'with `available: false` and a `reason`. Not cached.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Usage history (`available: true`), or why it is not available (`available: false` with `reason`)',
    type: UserUsageHistoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Missing or unknown `period`, or an unexpected query parameter',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  getUserUsageHistory(
    @Req() req: Request,
    @Query() query: GetUserUsageHistoryQueryDto,
  ): Promise<UserUsageHistoryResponseDto> {
    const { at } = req.user as SessionUser;
    return this.usageHistoryService.getUsageHistory(at, query.period);
  }
}
