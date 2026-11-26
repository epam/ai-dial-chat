import { Global, Module } from '@nestjs/common';
import { DialAnalyticsClientService } from './dial-analytics-client.service';

/** Provides the process-wide DIAL Analytics SDK client to every domain. */
@Global()
@Module({
  providers: [DialAnalyticsClientService],
  exports: [DialAnalyticsClientService],
})
export class DialAnalyticsModule {}
