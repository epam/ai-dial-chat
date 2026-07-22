import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { ClientChannelController } from './client-channel.controller';
import { ClientChannelService } from './client-channel.service';

@Module({
  imports: [AppConfigModule],
  controllers: [ClientChannelController],
  providers: [ClientChannelService],
  exports: [ClientChannelService],
})
export class ClientChannelModule {}
