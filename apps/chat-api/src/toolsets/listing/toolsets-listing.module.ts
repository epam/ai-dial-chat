import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../../deployments/deployments.module';
import { UserConfigModule } from '../../user-config/user-config.module';
import { ToolsetsListingService } from './toolsets-listing.service';

/*
 * The toolsets listing on its own, with no controllers: applications read the
 * caller's toolsets for the duplicate check without importing the whole
 * toolsets module, which would also move its controllers earlier in the
 * generated OpenAPI document.
 */
@Module({
  imports: [UserConfigModule, DeploymentsModule],
  providers: [ToolsetsListingService],
  exports: [ToolsetsListingService],
})
export class ToolsetsListingModule {}
