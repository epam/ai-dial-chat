import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ToolsetsListingModule } from '../toolsets/listing/toolsets-listing.module';
import { ResourceIdentityService } from './resource-identity.service';

@Module({
  imports: [DeploymentsModule, ToolsetsListingModule],
  providers: [ResourceIdentityService],
  exports: [ResourceIdentityService],
})
export class ResourceIdentityModule {}
