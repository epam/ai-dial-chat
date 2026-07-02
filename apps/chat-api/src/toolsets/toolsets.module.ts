import { Module } from '@nestjs/common';
import { UserConfigModule } from '../user-config/user-config.module';
import { ToolsetsController } from './toolsets.controller';
import { ToolsetsService } from './toolsets.service';

@Module({
  imports: [UserConfigModule],
  controllers: [ToolsetsController],
  providers: [ToolsetsService],
  exports: [ToolsetsService],
})
export class ToolsetsModule {}
