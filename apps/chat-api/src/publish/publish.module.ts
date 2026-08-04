import { Module } from '@nestjs/common';
import { PublishRulesController } from './publish-rules.controller';
import { PublishRulesService } from './publish-rules.service';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

@Module({
  controllers: [PublishController, PublishRulesController],
  providers: [PublishService, PublishRulesService],
})
export class PublishModule {}
