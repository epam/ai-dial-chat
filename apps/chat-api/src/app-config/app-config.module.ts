import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';

@Module({
  controllers: [AppConfigController],
})
export class AppConfigModule {}
