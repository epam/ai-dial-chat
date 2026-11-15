import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ResourceIdentityModule } from '../resource-identity/resource-identity.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ToolsetsAuthService } from './auth/toolsets-auth.service';
import { ToolsetsListingModule } from './listing/toolsets-listing.module';
import { McpAppController } from './mcp-app.controller';
import { McpAppService } from './mcp-app.service';
import { ToolsetsMutationService } from './mutation/toolsets-mutation.service';
import { ToolsetsController } from './toolsets.controller';
import { ToolsetsService } from './toolsets.service';

@Module({
  imports: [
    UserConfigModule,
    DeploymentsModule,
    ToolsetsListingModule,
    ResourceIdentityModule,
  ],
  controllers: [ToolsetsController, McpAppController],
  providers: [
    ToolsetsService,
    ToolsetsMutationService,
    ToolsetsAuthService,
    McpAppService,
  ],
  exports: [ToolsetsService],
})
export class ToolsetsModule {}
