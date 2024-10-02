import { BasePage } from '@/src/ui/pages/basePage';
import { MarketplaceContainer } from '@/src/ui/webElements/marketplace/marketplaceContainer';

export class MarketplacePage extends BasePage {
  private marketplaceContainer!: MarketplaceContainer;

  getMarketplaceContainer() {
    if (!this.marketplaceContainer) {
      this.marketplaceContainer = new MarketplaceContainer(this.page);
    }
    return this.marketplaceContainer;
  }
}
