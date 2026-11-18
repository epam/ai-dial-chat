import { Module } from '@nestjs/common';
import { AnalyticsClient } from './analytics/analytics.client';
import { UsageHistoryService } from './usage-history.service';
import { UserUsageHistoryController } from './user-usage-history.controller';

@Module({
  controllers: [UserUsageHistoryController],
  providers: [AnalyticsClient, UsageHistoryService],
})
export class UsageHistoryModule {}
