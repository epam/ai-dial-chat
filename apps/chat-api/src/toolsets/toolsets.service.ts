import { Injectable } from '@nestjs/common';
import { ToolsetsAuthService } from './auth/toolsets-auth.service';
import { ToolsetsListingService } from './listing/toolsets-listing.service';
import { ToolsetsMutationService } from './mutation/toolsets-mutation.service';

/*
 * Thin orchestrator for ToolsetsController and other domains that inject
 * ToolsetsService directly (external-services, client-channel, share). Every
 * method here delegates to exactly one of the three focused services below —
 * see openspec/changes/split-deployments-toolsets-services/design.md for the
 * ownership map and why the split follows this boundary.
 */
@Injectable()
export class ToolsetsService {
  constructor(
    private readonly listingService: ToolsetsListingService,
    private readonly mutationService: ToolsetsMutationService,
    private readonly authService: ToolsetsAuthService,
  ) {}

  // Listing
  listToolsets = this.listingService.listToolsets.bind(this.listingService);
  getToolset = this.listingService.getToolset.bind(this.listingService);
  resolveToolsetItem = this.listingService.resolveToolsetItem.bind(
    this.listingService,
  );
  invalidateListCache = this.listingService.invalidateListCache.bind(
    this.listingService,
  );

  // Mutation
  createToolset = this.mutationService.createToolset.bind(this.mutationService);
  updateToolset = this.mutationService.updateToolset.bind(this.mutationService);
  deleteToolset = this.mutationService.deleteToolset.bind(this.mutationService);

  // Auth
  loginToolset = this.authService.loginToolset.bind(this.authService);
  logoutToolset = this.authService.logoutToolset.bind(this.authService);
}
