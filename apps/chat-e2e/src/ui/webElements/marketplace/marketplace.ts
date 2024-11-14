import { MarketplaceSelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement } from '@/src/ui/webElements';
import { Applications } from '@/src/ui/webElements/marketplace/applications';
import { MarketplaceHeader } from '@/src/ui/webElements/marketplace/marketplaceHeader';
import { Locator, Page } from '@playwright/test';

export class Marketplace extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MarketplaceSelectors.marketplaceContainer, parentLocator);
  }

  private applications!: Applications;
  private marketplaceHeader!: MarketplaceHeader;

  getApplications(): Applications {
    if (!this.applications) {
      this.applications = new Applications(this.page, this.rootLocator);
    }
    return this.applications;
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
