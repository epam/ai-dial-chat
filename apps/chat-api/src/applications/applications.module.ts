import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ToolsetsListingModule } from '../toolsets/listing/toolsets-listing.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [DeploymentsModule, ToolsetsListingModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
