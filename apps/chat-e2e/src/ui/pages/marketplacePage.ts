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

  async openMyWorkspacePage(
    options: {
      updateInstalledDeployments?: boolean;
      getInstalledDeployments?: boolean;
      getPublishedApplications?: boolean;
    } = {
      updateInstalledDeployments: true,
      getInstalledDeployments: false,
      getPublishedApplications: true,
    },
  ): Promise<void> {
    await this.openMarketplaceUrl(ExpectedConstants.workspacePath(), {
      updateInstalledDeployments: options.updateInstalledDeployments,
      getInstalledDeployments: options.getInstalledDeployments,
      getPublishedApplications: options.getPublishedApplications,
    });
    await this.waitForPageLoaded();
  }

  async openMarketplacePage(
    options: {
      updateInstalledDeployments?: boolean;
      getInstalledDeployments?: boolean;
      getPublishedApplications?: boolean;
    } = {
      updateInstalledDeployments: true,
      getInstalledDeployments: false,
      getPublishedApplications: true,
    },
  ): Promise<void> {
    await this.openMarketplaceUrl(ExpectedConstants.marketplacePath, {
      updateInstalledDeployments: options.updateInstalledDeployments,
      getInstalledDeployments: options.getInstalledDeployments,
      getPublishedApplications: options.getPublishedApplications,
    });
    await this.waitForPageLoaded();
  }

  async openCreateCustomAppPage(
    options: {
      updateInstalledDeployments?: boolean;
      getInstalledDeployments?: boolean;
      getPublishedApplications?: boolean;
    } = {
      updateInstalledDeployments: true,
      getInstalledDeployments: false,
      getPublishedApplications: false,
    },
  ): Promise<void> {
    await this.openMarketplaceUrl(ExpectedConstants.createCustomAppPath, {
      updateInstalledDeployments: options.updateInstalledDeployments,
      getInstalledDeployments: options.getInstalledDeployments,
      getPublishedApplications: options.getPublishedApplications,
    });
  }

  private async openMarketplaceUrl(
    url: string,
    options: {
      updateInstalledDeployments?: boolean;
      getInstalledDeployments?: boolean;
      getPublishedApplications?: boolean;
    } = {},
  ): Promise<void> {
    const responsePromises = [];
    const commonGetHosts: string[] = [];

    if (options.getInstalledDeployments) {
      commonGetHosts.push(API.installedDeploymentsHost());
    }
    if (options.getPublishedApplications) {
      commonGetHosts.push(API.publishedApplicationsHost);
    }

    // Wait for the common GET requests
    for (const host of commonGetHosts) {
      const resp = this.page.waitForResponse(
        (resp) =>
          resp.url().includes(host) &&
          resp.request().method() === 'GET' &&
          resp.status() === 200,
      );
      responsePromises.push(resp);
    }

    // Wait for the PUT request if needed
    if (options.updateInstalledDeployments) {
      const putResp = this.page.waitForResponse(
        (resp) =>
          resp.url().includes(API.installedDeploymentsHost()) &&
          resp.request().method() === 'PUT' &&
          resp.status() === 200,
      );
      responsePromises.push(putResp);
    }

    // Perform navigation and wait for all expected responses
    await this.navigateToUrl(url);
    for (const resp of responsePromises) {
      await resp;
    }
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
