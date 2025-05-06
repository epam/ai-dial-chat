import config from '@/config/chat.playwright.config';
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
    updateInstalledDeployments = true,
  }: { updateInstalledDeployments?: boolean } = {}) {
    if (updateInstalledDeployments) {
      const resp = this.page.waitForResponse(
        (resp) =>
          resp.url().includes(API.installedDeploymentsHost()) &&
          resp.request().method() === 'PUT' &&
          resp.status() === 200,
      );
      await this.navigateToUrl(ExpectedConstants.workspacePath());
      await resp;
    } else {
      await this.navigateToUrl(ExpectedConstants.workspacePath());
    }
    await this.waitForPageLoaded();
  }

  async openMarketplacePage() {
    const responses = [];
    const hostsArray = [
      API.publishedApplicationsHost,
      API.installedDeploymentsHost(),
    ];
    for (const host of hostsArray) {
      const resp = this.page.waitForResponse(
        (resp) => resp.url().includes(host) && resp.status() === 200,
      );
      responses.push(resp);
    }
    await this.navigateToUrl(ExpectedConstants.marketplacePath);
    for (const resp of responses) {
      await resp;
    }
    await this.waitForPageLoaded();
  }

  async waitForPageLoaded() {
    const marketplaceContainer = this.getMarketplaceContainer();
    const marketplace = marketplaceContainer.getMarketplace();
    await marketplace.waitForState({ timeout: config.use!.actionTimeout! * 3 });
    await this.marketplaceContainer
      .getChatLoader()
      .waitForState({ state: 'hidden' });
    await marketplace.getMarketplaceHeader().waitForState();
  }
}
