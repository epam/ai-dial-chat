import { Routes } from '@/chat/constants/routes';
import { ApplicationType } from '@/chat/types/applications';
import config from '@/config/chat.playwright.config';
import {
  API,
  ExpectedConstants,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  MarketplaceUrlBuilder,
} from '@/src/testData';
import { EntityEditorUrlBuilder } from '@/src/testData/marketplace/entityEditorUrlBuilder';
import { BasePage, ExpectedApiResponse } from '@/src/ui/pages/basePage';
import { EntityEditSteps } from '@/src/ui/webElements';
import { MarketplaceContainer } from '@/src/ui/webElements/marketplace/marketplaceContainer';

interface MarketplacePageOptions {
  updateInstalledDeployments?: boolean;
  getInstalledDeployments?: boolean;
  getPublishedApplications?: boolean;
  updateInstalledToolsets?: boolean;
  getInstalledToolsets?: boolean;
  getToolsets?: boolean;
  getStyles?: boolean;
}

interface MarketplaceEntityOptions {
  updateInstalledEntities?: boolean;
  getInstalledEntities?: boolean;
  getEntities?: boolean;
}

const DEFAULT_MARKETPLACE_OPTIONS: MarketplacePageOptions = {
  updateInstalledDeployments: true,
  getInstalledDeployments: false,
  getPublishedApplications: true,
  updateInstalledToolsets: true,
  getInstalledToolsets: false,
  getToolsets: true,
  getStyles: false,
};

const DEFAULT_ENTITY_OPTIONS: MarketplaceEntityOptions = {
  updateInstalledEntities: true,
  getInstalledEntities: false,
  getEntities: false,
};

interface EntityConfig {
  apiHosts: {
    installedEntitiesApi: string;
    entitiesApi: string;
  };
  route: Routes;
  hasEntityTabInReturnUrl?: boolean;
}

export class MarketplacePage extends BasePage {
  private marketplaceContainer!: MarketplaceContainer;

  getMarketplaceContainer() {
    if (!this.marketplaceContainer) {
      this.marketplaceContainer = new MarketplaceContainer(this.page);
    }
    return this.marketplaceContainer;
  }

  async openMyWorkspacePage(options = {}): Promise<void> {
    const mergedOptions = { ...DEFAULT_MARKETPLACE_OPTIONS, ...options };
    await this.openMarketplaceUrl(
      ExpectedConstants.workspacePath(),
      mergedOptions,
    );
    await this.waitForPageLoaded();
  }

  async openMarketplacePage(options = {}): Promise<void> {
    const mergedOptions = { ...DEFAULT_MARKETPLACE_OPTIONS, ...options };
    await this.openMarketplaceUrl(
      ExpectedConstants.marketplacePath,
      mergedOptions,
    );
    await this.waitForPageLoaded();
  }

  private async openMarketplaceUrl(url: string, options = {}): Promise<void> {
    const expectedResponses = this.buildMarketplaceResponses(options);
    await this.waitForExpectedResponses(
      () => this.navigateToUrl(url),
      expectedResponses,
    );
  }

  async openCreateCustomAppPage() {
    await this.openCreateEntityPage(
      MarketplaceEntitiesTabs.AGENTS,
      ApplicationType.CUSTOM_APP,
    );
  }

  async openCreateToolsetPage() {
    await this.openCreateEntityPage(
      MarketplaceEntitiesTabs.TOOLSETS,
      undefined,
      { getEntities: true },
    );
  }

  async openEditToolsetPage(id: string) {
    await this.openEditEntityPage(
      id,
      MarketplaceEntitiesTabs.TOOLSETS,
      undefined,
      {
        getEntities: true,
      },
    );
  }

  private async openCreateEntityPage(
    entityTab: MarketplaceEntitiesTabs,
    appTypeSchema?: ApplicationType | string,
    options: MarketplaceEntityOptions = {},
  ): Promise<void> {
    const entityEditorAttributes = this.getCreateEntityEditorAttributes(
      entityTab,
      EntityEditSteps.generalInfo,
      appTypeSchema,
    );
    await this.navigateToEntityEditorPage(options, entityEditorAttributes);
  }

  private async openEditEntityPage(
    id: string,
    entityTab: MarketplaceEntitiesTabs,
    appTypeSchema?: ApplicationType | string,
    options: MarketplaceEntityOptions = {},
  ): Promise<void> {
    const entityEditorAttributes = this.getEditEntityEditorAttributes(
      entityTab,
      id,
      appTypeSchema,
    );
    await this.navigateToEntityEditorPage(options, entityEditorAttributes);
  }

  private getCreateEntityEditorAttributes(
    entityTab: MarketplaceEntitiesTabs,
    step: EntityEditSteps,
    appTypeSchema?: ApplicationType | string,
  ): {
    entityEditorPath: string;
    entityApiHosts: {
      installedEntitiesApi?: string;
      entitiesApi?: string;
    };
  } {
    const config = this.getEntityConfig(entityTab);
    const returnUrl = this.buildReturnUrl(
      MarketplaceTabs.WORKSPACE,
      entityTab,
      config,
    );
    let entityEditorUrlBuilder = new EntityEditorUrlBuilder(config.route, step)
      .withReturnUrl(returnUrl)
      .withIsCreating();
    if (appTypeSchema) {
      entityEditorUrlBuilder = entityEditorUrlBuilder.withSchema(appTypeSchema);
    }
    return {
      entityEditorPath: entityEditorUrlBuilder.build(),
      entityApiHosts: config.apiHosts,
    };
  }

  private getEditEntityEditorAttributes(
    entityTab: MarketplaceEntitiesTabs,
    id: string,
    appTypeSchema?: ApplicationType | string,
  ): {
    entityEditorPath: string;
    entityApiHosts: {
      installedEntitiesApi?: string;
      entitiesApi?: string;
    };
  } {
    const config = this.getEntityConfig(entityTab);
    const returnUrl = this.buildReturnUrl(
      MarketplaceTabs.WORKSPACE,
      entityTab,
      config,
    );
    const step =
      entityTab === MarketplaceEntitiesTabs.TOOLSETS
        ? EntityEditSteps.toolsetSettings
        : EntityEditSteps.appSettings;
    let entityEditorUrlBuilder = new EntityEditorUrlBuilder(config.route, step)
      .withReturnUrl(returnUrl)
      .withId(id);
    if (appTypeSchema) {
      entityEditorUrlBuilder = entityEditorUrlBuilder.withSchema(appTypeSchema);
    }
    return {
      entityEditorPath: entityEditorUrlBuilder.build(),
      entityApiHosts: config.apiHosts,
    };
  }

  private getEntityConfig(entityTab: MarketplaceEntitiesTabs) {
    const entityConfigs: Record<MarketplaceEntitiesTabs, EntityConfig> = {
      [MarketplaceEntitiesTabs.AGENTS]: {
        apiHosts: {
          installedEntitiesApi: API.installedDeploymentsHost(),
          entitiesApi: API.publishedApplicationsHost(),
        },
        route: Routes.AppsEditor,
      },
      [MarketplaceEntitiesTabs.TOOLSETS]: {
        apiHosts: {
          installedEntitiesApi: API.installedToolsetsHost(),
          entitiesApi: API.toolsetsHost(),
        },
        route: Routes.ToolsetEditor,
        hasEntityTabInReturnUrl: true,
      },
    };
    const config = entityConfigs[entityTab];
    if (!config) {
      throw new Error(`Unsupported entity tab: ${entityTab}`);
    }
    return config;
  }

  private buildReturnUrl(
    tab: MarketplaceTabs,
    entityTab: MarketplaceEntitiesTabs,
    entityConfig: EntityConfig,
  ) {
    let returnUrl = new MarketplaceUrlBuilder(false).withTab(tab).build();
    if (entityConfig.hasEntityTabInReturnUrl) {
      // Only this specific part should be encoded
      returnUrl += encodeURIComponent(`&entitiesTab=${entityTab}`);
    }
    return returnUrl;
  }

  private async navigateToEntityEditorPage(
    options: MarketplaceEntityOptions = {},
    entityEditorAttributes: {
      entityEditorPath: string;
      entityApiHosts: {
        installedEntitiesApi?: string;
        entitiesApi?: string;
      };
    },
  ) {
    const mergedOptions = { ...DEFAULT_ENTITY_OPTIONS, ...options };
    const expectedResponses: ExpectedApiResponse[] = [];

    if (mergedOptions.getInstalledEntities) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: entityEditorAttributes.entityApiHosts.installedEntitiesApi,
      });
    }
    if (mergedOptions.getEntities) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: entityEditorAttributes.entityApiHosts.entitiesApi,
      });
    }
    if (mergedOptions.updateInstalledEntities) {
      expectedResponses.push({
        apiMethod: 'PUT',
        urlPattern: entityEditorAttributes.entityApiHosts.installedEntitiesApi,
      });
    }
    await this.waitForExpectedResponses(
      () => this.navigateToUrl(entityEditorAttributes.entityEditorPath),
      expectedResponses,
    );
  }

  private buildMarketplaceResponses(
    options: MarketplacePageOptions,
  ): ExpectedApiResponse[] {
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
        urlPattern: API.publishedApplicationsHost(),
      });
    }
    if (options.updateInstalledDeployments) {
      expectedResponses.push({
        apiMethod: 'PUT',
        urlPattern: API.installedDeploymentsHost(),
      });
    }
    if (options.getInstalledToolsets) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.installedToolsetsHost(),
      });
    }
    if (options.getToolsets) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.toolsetsHost(),
      });
    }
    if (options.updateInstalledToolsets) {
      expectedResponses.push({
        apiMethod: 'PUT',
        urlPattern: API.installedToolsetsHost(),
      });
    }
    if (options.getStyles) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.themeStylesHost,
      });
    }
    return expectedResponses;
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
