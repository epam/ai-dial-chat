import { Module } from '@nestjs/common';
import { UserConfigModule } from '../user-config/user-config.module';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { DeploymentsDetailsService } from './details/deployments-details.service';
import { DeploymentsListingService } from './listing/deployments-listing.service';
import { DeploymentsLookupService } from './lookup/deployments-lookup.service';

@Module({
  imports: [UserConfigModule],
  controllers: [DeploymentsController],
  providers: [
    DeploymentsService,
    DeploymentsListingService,
    DeploymentsLookupService,
    DeploymentsDetailsService,
  ],
  exports: [DeploymentsService, DeploymentsDetailsService],
})
export class DeploymentsModule {}
