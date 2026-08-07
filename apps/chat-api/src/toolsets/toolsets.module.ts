import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ToolsetsAuthService } from './auth/toolsets-auth.service';
import { ToolsetsListingService } from './listing/toolsets-listing.service';
import { ToolsetsMutationService } from './mutation/toolsets-mutation.service';
import { ToolsetsController } from './toolsets.controller';
import { ToolsetsService } from './toolsets.service';

@Module({
  imports: [UserConfigModule, DeploymentsModule],
  controllers: [ToolsetsController],
  providers: [
    ToolsetsService,
    ToolsetsListingService,
    ToolsetsMutationService,
    ToolsetsAuthService,
  ],
  exports: [ToolsetsService],
})
export class ToolsetsModule {}
