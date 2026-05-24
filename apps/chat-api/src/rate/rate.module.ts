import { Module } from '@nestjs/common';
import { RateController } from './rate.controller.js';
import { RateService } from './rate.service.js';

@Module({
  controllers: [RateController],
  providers: [RateService],
})
export class RateModule {}
