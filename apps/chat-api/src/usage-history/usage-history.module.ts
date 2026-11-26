import { Module } from '@nestjs/common';
import { UsageHistoryService } from './usage-history.service';
import { UserUsageHistoryController } from './user-usage-history.controller';

@Module({
  controllers: [UserUsageHistoryController],
  providers: [UsageHistoryService],
})
export class UsageHistoryModule {}
