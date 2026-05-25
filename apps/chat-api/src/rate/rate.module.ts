import { Module } from '@nestjs/common';
import { RateController } from './rate.controller';
import { RateService } from './rate.service';

@Module({
  controllers: [RateController],
  providers: [RateService],
})
export class RateModule {}
