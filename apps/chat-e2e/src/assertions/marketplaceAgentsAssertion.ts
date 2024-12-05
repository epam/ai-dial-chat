import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { MarketplaceAgents } from '@/src/ui/webElements';

export class MarketplaceAgentsAssertion extends BaseAssertion {
  readonly MarketplaceAgents: MarketplaceAgents;

  constructor(marketplaceApplications: MarketplaceAgents) {
    super();
    this.MarketplaceAgents = marketplaceApplications;
  }
}
