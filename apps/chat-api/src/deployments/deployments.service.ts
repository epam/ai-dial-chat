import { Injectable } from '@nestjs/common';
import { DeploymentsDetailsService } from './details/deployments-details.service';
import { DeploymentsListingService } from './listing/deployments-listing.service';
import { DeploymentsLookupService } from './lookup/deployments-lookup.service';

/*
 * Thin orchestrator for DeploymentsController. Every method here delegates
 * to exactly one of the three focused services below — see
 * openspec/changes/split-deployments-toolsets-services/design.md for the
 * ownership map and why the split follows this boundary. Note that
 * ToolsetsListingService injects DeploymentsDetailsService directly (not
 * this facade) for invalidateDetailsCache — see toolsets-listing.service.ts.
 */
@Injectable()
export class DeploymentsService {
  constructor(
    private readonly listingService: DeploymentsListingService,
    private readonly lookupService: DeploymentsLookupService,
    private readonly detailsService: DeploymentsDetailsService,
  ) {}

  // Listing
  listDeployments = this.listingService.listDeployments.bind(
    this.listingService,
  );
  invalidateListCache = this.listingService.invalidateListCache.bind(
    this.listingService,
  );

  // Lookup
  resolveDeploymentItem = this.lookupService.resolveDeploymentItem.bind(
    this.lookupService,
  );

  // Details
  getDeploymentDetails = this.detailsService.getDeploymentDetails.bind(
    this.detailsService,
  );
  getDeploymentConfiguration =
    this.detailsService.getDeploymentConfiguration.bind(this.detailsService);
  getDeploymentLimits = this.detailsService.getDeploymentLimits.bind(
    this.detailsService,
  );
  invalidateDetailsCache = this.detailsService.invalidateDetailsCache.bind(
    this.detailsService,
  );
}
