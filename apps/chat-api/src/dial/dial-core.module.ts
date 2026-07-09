import { Global, Module } from '@nestjs/common';
import { DialClientService } from './dial-client.service';

@Global()
@Module({
  providers: [DialClientService],
  exports: [DialClientService],
})
export class DialCoreModule {}
