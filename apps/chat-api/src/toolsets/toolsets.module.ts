import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ToolsetsController } from './toolsets.controller';
import { ToolsetsService } from './toolsets.service';

@Module({
  imports: [UserConfigModule, DeploymentsModule],
  controllers: [ToolsetsController],
  providers: [ToolsetsService],
  exports: [ToolsetsService],
})
export class ToolsetsModule {}
