import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ToolsetsModule } from '../toolsets/toolsets.module';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

@Module({
  imports: [DeploymentsModule, ToolsetsModule],
  controllers: [ShareController],
  providers: [ShareService],
})
export class ShareModule {}
