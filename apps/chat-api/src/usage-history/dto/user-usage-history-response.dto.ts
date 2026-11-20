import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UsageHistoryPeriod } from '../types/usage-history-period';
import { UsageHistoryUnavailableReason } from '../types/usage-history-unavailable-reason';

const SPEND_DESCRIPTION =
  'Spend in USD, rounded to 6 decimal places (half away from zero). Without `budget`, summed ' +
  "from the root span's chain-inclusive price: a call to an application includes the models it " +
  'called. With `budget`, summed from the own price of the model calls that budget paid for.';

const REQUESTS_SCOPE =
  'Without `budget`, user requests (root spans); with `budget`, model calls the budget paid for.';

export class UsageHistoryBudgetDto {
  @ApiProperty({
    description: 'Cost object of the budget the history is narrowed to.',
    example: 'engineering',
  })
  costObject!: string;

  @ApiProperty({
    description: 'Policy of the budget the history is narrowed to.',
    example: 'policies/company/pro',
  })
  policy!: string;
}

export class UsageHistoryWindowDto {
  @ApiProperty({
    enum: UsageHistoryPeriod,
    enumName: 'UsageHistoryPeriod',
    description: 'The requested period.',
  })
  name!: UsageHistoryPeriod;

  @ApiProperty({
    description:
      'Inclusive window start: 00:00:00.000Z of the current UTC day, ISO week Monday, or month 1st.',
    example: '2026-11-01T00:00:00.000Z',
  })
  from!: string;

  @ApiProperty({
    description: 'Exclusive window end: the request time.',
    example: '2026-11-18T14:05:09.120Z',
  })
  to!: string;
}

export class UsageHistoryTotalsDto {
  @ApiProperty({ description: SPEND_DESCRIPTION, example: 1.234568 })
  spend!: number;

  @ApiProperty({
    description: `Number in the window. ${REQUESTS_SCOPE}`,
    example: 42,
  })
  requests!: number;
}

export class UsageHistoryDailyEntryDto {
  @ApiProperty({
    description: 'UTC calendar date, `YYYY-MM-DD`.',
    example: '2026-11-02',
  })
  date!: string;

  @ApiProperty({ description: SPEND_DESCRIPTION, example: 1 })
  spend!: number;

  @ApiProperty({
    description: `Number on that date. ${REQUESTS_SCOPE}`,
    example: 30,
  })
  requests!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description:
      "That date's spend per deployment, keyed by the deployment names of the top-level `byModel` " +
      '(including `other`). Keys with no spend and no requests on that date are omitted, so a date ' +
      'without usage has an empty object.',
    example: { 'gpt-4o': 0.9, 'my-app': 0.1 },
  })
  byModel!: Record<string, number>;
}

export class UsageHistoryModelEntryDto {
  @ApiProperty({
    description:
      'Root deployment the user called (with `budget`: the model the budget paid for), or ' +
      '`other` for the remainder beyond the top 10 by spend.',
    example: 'gpt-4o',
  })
  deployment!: string;

  @ApiProperty({ description: SPEND_DESCRIPTION, example: 1.134568 })
  spend!: number;

  @ApiProperty({
    description: `Number for this deployment. ${REQUESTS_SCOPE}`,
    example: 39,
  })
  requests!: number;
}

export class UsageHistoryClientEntryDto {
  @ApiProperty({
    description:
      "Client type from DIAL Analytics' `usage_client_identity` enrichment (for example `chat`, " +
      '`claudecode`, `claudedesktop`, `codex`, `opencode`, `dialcli`, `other`), or `unknown` when ' +
      'the enrichment has no value for the request.',
    example: 'chat',
  })
  client!: string;

  @ApiProperty({ description: SPEND_DESCRIPTION, example: 1 })
  spend!: number;

  @ApiProperty({
    description: `Number from this client. ${REQUESTS_SCOPE}`,
    example: 35,
  })
  requests!: number;
}

/**
 * `GET /user/usage/history` response. One flattened schema with a required
 * `available` flag, because OpenAPI 3.0 cannot discriminate a `oneOf` on a
 * boolean (see openspec/changes/archive/2026-11-20-add-user-usage-history-api/design.md, D7).
 */
export class UserUsageHistoryResponseDto {
  @ApiProperty({
    description:
      'Whether DIAL Analytics answered. `true`: `period`, `currency`, `totals`, `daily` and ' +
      '`byModel` are present (and `byClient` when the client-identity enrichment is available). ' +
      '`false`: only `reason` is present.',
    example: true,
  })
  available!: boolean;

  @ApiPropertyOptional({
    enum: UsageHistoryUnavailableReason,
    enumName: 'UsageHistoryUnavailableReason',
    description:
      'Present only when `available` is `false`. `not_configured`: ANALYTICS_URL is unset. ' +
      "`forbidden`: DIAL Analytics refused the caller's token, the caller cannot read the usage " +
      'log, or DIAL Analytics cannot run the own-rows filter (no query caller values, or `user_hash` ' +
      'hidden from the caller). `unavailable`: timeout, ' +
      'network error or server error. ' +
      "`budget_unsupported`: `costObject` and `policy` were given, but the caller's DIAL Analytics " +
      'schema of the usage log has no budget columns.',
  })
  reason?: UsageHistoryUnavailableReason;

  @ApiPropertyOptional({
    type: () => UsageHistoryBudgetDto,
    description:
      'Present only when `available` is `true` and the request named a budget: every figure is ' +
      "then that budget's, from the model calls it paid for. Rows written before DIAL Core logged " +
      'the charged budget carry none and are not counted.',
  })
  budget?: UsageHistoryBudgetDto;

  @ApiPropertyOptional({
    type: () => UsageHistoryWindowDto,
    description:
      'Present only when `available` is `true`. The half-open window `[from, to)`.',
  })
  period?: UsageHistoryWindowDto;

  @ApiPropertyOptional({
    description:
      'Present only when `available` is `true`. Always `USD`: DIAL Analytics prices carry no currency.',
    example: 'USD',
  })
  currency?: string;

  @ApiPropertyOptional({
    type: () => UsageHistoryTotalsDto,
    description:
      'Present only when `available` is `true`. Spend and requests of the whole window.',
  })
  totals?: UsageHistoryTotalsDto;

  @ApiPropertyOptional({
    type: () => [UsageHistoryDailyEntryDto],
    description:
      'Present only when `available` is `true`. One entry per UTC date of the window, ascending, ' +
      'zero-filled.',
  })
  daily?: UsageHistoryDailyEntryDto[];

  @ApiPropertyOptional({
    type: () => [UsageHistoryModelEntryDto],
    description:
      'Present only when `available` is `true`. Root deployments by spend descending, at most 10, ' +
      'followed by one `other` entry with the remainder when more than 10 have usage. When the ' +
      'request named a budget, the entries are the models whose calls that budget paid for, ' +
      'including models called by an application or other deployment, not root deployments.',
  })
  byModel?: UsageHistoryModelEntryDto[];

  @ApiPropertyOptional({
    type: () => [UsageHistoryClientEntryDto],
    description:
      'Present only when `available` is `true` and DIAL Analytics exposes the client-identity ' +
      'enrichment to the caller; absent (not empty) otherwise. Sorted by spend descending. When the ' +
      'request named a budget, each paid model call is classified from its own request headers, so a ' +
      "model call made by an application may count toward that application's client rather than " +
      'the client the user called the application from.',
  })
  byClient?: UsageHistoryClientEntryDto[];
}
