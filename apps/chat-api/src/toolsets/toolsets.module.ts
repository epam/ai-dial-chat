import { Module } from '@nestjs/common';
import { ToolsetsController } from './toolsets.controller';
import { ToolsetsService } from './toolsets.service';

@Module({
  controllers: [ToolsetsController],
  providers: [ToolsetsService],
  exports: [ToolsetsService],
})
export class ToolsetsModule {}
