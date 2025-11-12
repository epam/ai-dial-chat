import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { MarketplaceEntities } from '@/src/ui/webElements';

export class MarketplaceEntitiesAssertion extends BaseAssertion {
  readonly marketplaceEntities: MarketplaceEntities;

  constructor(marketplaceEntities: MarketplaceEntities) {
    super();
    this.marketplaceEntities = marketplaceEntities;
  }
}
