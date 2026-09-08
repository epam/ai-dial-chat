import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { SkillsModule } from '../skills/skills.module';
import { ToolsetsModule } from '../toolsets/toolsets.module';
import { ShareInvitationService } from './invitation/share-invitation.service';
import { ShareManagementService } from './management/share-management.service';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

@Module({
  imports: [DeploymentsModule, ToolsetsModule, SkillsModule],
  controllers: [ShareController],
  providers: [ShareService, ShareInvitationService, ShareManagementService],
})
export class ShareModule {}
