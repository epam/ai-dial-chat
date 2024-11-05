import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { Applications } from '@/src/ui/webElements';

export class MarketplaceApplicationsAssertion extends BaseAssertion {
  readonly marketplaceApplications: Applications;

  constructor(marketplaceApplications: Applications) {
    super();
    this.marketplaceApplications = marketplaceApplications;
  }
}
