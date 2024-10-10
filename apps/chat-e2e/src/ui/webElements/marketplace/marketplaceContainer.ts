import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';
import { Marketplace } from '@/src/ui/webElements/marketplace/marketplace';
import { MarketplaceSidebar } from '@/src/ui/webElements/marketplace/marketplaceSidebar';

export class MarketplaceContainer extends BaseLayoutContainer {
  private marketplace!: Marketplace;
  private marketplaceSidebar!: MarketplaceSidebar;

  getMarketplace(): Marketplace {
    if (!this.marketplace) {
      this.marketplace = new Marketplace(this.page, this.rootLocator);
    }
    return this.marketplace;
  }

  getMarketplaceSidebar(): MarketplaceSidebar {
    if (!this.marketplaceSidebar) {
      this.marketplaceSidebar = new MarketplaceSidebar(
        this.page,
        this.rootLocator,
      );
    }
    return this.marketplaceSidebar;
  }

  getChatLoader(): BaseElement {
    return this.getChildElementBySelector(ChatSelectors.messageSpinner);
  }
}
