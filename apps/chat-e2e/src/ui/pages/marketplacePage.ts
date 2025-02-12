import { API, ExpectedConstants } from '@/src/testData';
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

  async openMyWorkspacePage({
    isInstalledDeploymentsUpdated = true,
  }: { isInstalledDeploymentsUpdated?: boolean } = {}) {
    if (isInstalledDeploymentsUpdated) {
      const resp = this.page.waitForResponse(
        (resp) =>
          resp.url().includes(API.installedDeploymentsHost()) &&
          resp.request().method() === 'PUT' &&
          resp.status() === 200,
      );
      await this.navigateToUrl(ExpectedConstants.workspacePath);
      await resp;
    } else {
      await this.navigateToUrl(ExpectedConstants.workspacePath);
    }
    await this.waitForPageLoaded();
  }

  async waitForPageLoaded() {
    const marketplaceContainer = this.getMarketplaceContainer();
    const marketplace = marketplaceContainer.getMarketplace();
    await this.marketplaceContainer
      .getChatLoader()
      .waitForState({ state: 'hidden' });
    await marketplace.waitForState();
    await marketplace.getMarketplaceHeader().waitForState();
  }
}
