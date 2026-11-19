import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UsageHistoryPeriod } from '../types/usage-history-period';

/** Query of `GET /user/usage/history`. `period` is the only accepted input. */
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
}
