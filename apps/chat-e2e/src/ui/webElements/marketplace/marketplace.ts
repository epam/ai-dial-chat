import { marketplaceContainer } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { MarketplaceAgents } from '@/src/ui/webElements/marketplace/marketplaceAgents';
import { MarketplaceHeader } from '@/src/ui/webElements/marketplace/marketplaceHeader';
import { Locator, Page } from '@playwright/test';

export class Marketplace extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, marketplaceContainer, parentLocator);
  }

  private agents!: MarketplaceAgents;
  private marketplaceHeader!: MarketplaceHeader;

  getAgents(): MarketplaceAgents {
    if (!this.agents) {
      this.agents = new MarketplaceAgents(this.page, this.rootLocator);
    }
    return this.agents;
  }

  getMarketplaceHeader(): MarketplaceHeader {
    if (!this.marketplaceHeader) {
      this.marketplaceHeader = new MarketplaceHeader(
        this.page,
        this.rootLocator,
      );
    }
    return this.marketplaceHeader;
  }
}
