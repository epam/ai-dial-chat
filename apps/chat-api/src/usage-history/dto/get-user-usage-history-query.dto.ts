import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { UsageHistoryPeriod } from '../types/usage-history-period';

/** Longest accepted cost object or policy path; DIAL Core paths are far shorter. */
export const BUDGET_KEY_MAX_LENGTH = 1024;

/* Both budget parameters are validated as soon as either is present, so one alone is a 400. */
const hasBudget = (query: GetUserUsageHistoryQueryDto): boolean =>
  query.costObject !== undefined || query.policy !== undefined;

/**
 * Query of `GET /user/usage/history`: the period, and optionally one budget
 * (`costObject` with `policy`) to narrow the history to.
 */
export class GetUserUsageHistoryQueryDto {
  @ApiProperty({
    description:
      'Calendar period, in UTC: `today` is the current day, `week` the current ISO week ' +
      '(Monday start) and `month` the current month, each from its start to the request time.',
    enum: UsageHistoryPeriod,
    enumName: 'UsageHistoryPeriod',
    example: UsageHistoryPeriod.Month,
  })
  @IsEnum(UsageHistoryPeriod)
  period!: UsageHistoryPeriod;

  @ApiPropertyOptional({
    description:
      'Cost object of the budget to narrow the history to, as `costObject` of a `budgets` entry ' +
      'of `GET /user/limits`. Requires `policy`.',
    example: 'engineering',
    maxLength: BUDGET_KEY_MAX_LENGTH,
  })
  @ValidateIf(hasBudget)
  @IsString()
  @IsNotEmpty()
  @MaxLength(BUDGET_KEY_MAX_LENGTH)
  costObject?: string;

  @ApiPropertyOptional({
    description:
      'Policy of the budget to narrow the history to, as `policy` of a `budgets` entry of ' +
      '`GET /user/limits`. Requires `costObject`.',
    example: 'policies/company/pro',
    maxLength: BUDGET_KEY_MAX_LENGTH,
  })
  @ValidateIf(hasBudget)
  @IsString()
  @IsNotEmpty()
  @MaxLength(BUDGET_KEY_MAX_LENGTH)
  policy?: string;
}
