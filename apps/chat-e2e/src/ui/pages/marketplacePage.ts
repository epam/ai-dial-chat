import config from '@/config/chat.playwright.config';
import { API, ExpectedConstants } from '@/src/testData';
import { BasePage, ExpectedApiResponse } from '@/src/ui/pages/basePage';
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
    const expectedResponses: ExpectedApiResponse[] = [];

    if (options.getInstalledDeployments) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.installedDeploymentsHost(),
      });
    }
    if (options.getPublishedApplications) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.publishedApplicationsHost,
      });
    }

    if (options.updateInstalledDeployments) {
      expectedResponses.push({
        apiMethod: 'PUT',
        urlPattern: API.installedDeploymentsHost(),
      });
    }

    await this.waitForExpectedResponses(
      () => this.navigateToUrl(url),
      expectedResponses,
    );
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
