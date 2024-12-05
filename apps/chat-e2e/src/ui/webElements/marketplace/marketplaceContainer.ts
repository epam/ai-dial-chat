import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';
import { Marketplace } from '@/src/ui/webElements/marketplace/marketplace';
import { MarketplaceSidebar } from '@/src/ui/webElements/marketplace/marketplaceSidebar';
import { ModelsUtil } from '@/src/utils';

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

  public async goToMarketplaceHome() {
    const respPromise = this.page.waitForResponse(
      (r) => r.request().method() === 'GET',
    );
    await this.getMarketplaceSidebar().marketplaceHomePageButton.click();
    await respPromise;
    const allExpectedAgents = ModelsUtil.getLatestOpenAIEntities();
    await this.getMarketplace()
      .getAgents()
      .waitForAgentByIndex(allExpectedAgents.length);
  }
}
