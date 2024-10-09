import { ChatSelectors, ChatSettingsSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { DialAIEntityModel } from '@/chat/types/models';
import { API } from '@/src/testData';
import { MarketplacePage } from '@/src/ui/pages';
import { RecentEntities } from '@/src/ui/webElements/recentEntities';
import { TalkToEntities } from '@/src/ui/webElements/talkToEntities';
import { Locator, Page } from '@playwright/test';

export class EntitySelector extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsSelectors.entitySelector, parentLocator);
  }

  private recentEntities!: RecentEntities;
  private searchOnMyApplicationsButton = this.getChildElementBySelector(
    ChatSettingsSelectors.searchOnMyApplications,
  );

  getRecentEntities(): RecentEntities {
    if (!this.recentEntities) {
      this.recentEntities = new RecentEntities(this.page, this.rootLocator);
    }
    return this.recentEntities;
  }

  public async searchOnMyAppButton() {
    const responsePromise = this.page.waitForResponse((resp) =>
      resp.url().includes(API.installedDeploymentsHost),
    );
    const responsePromise2 = this.page.waitForResponse((resp) =>
      resp.url().includes(API.installedDeploymentsHost),
    );
    await this.searchOnMyApplicationsButton.click();
    await responsePromise;
  }

  public async selectEntity(
    entity: DialAIEntityModel,
    marketplacePage: MarketplacePage,
  ) {
    const recentEntities = this.getRecentEntities();
    const recentTalkToEntities = recentEntities
      .getTalkToGroup()
      .getTalkToEntities();
    //check if entity is among recent ones
    const isRecentEntitySelected = await this.isEntitySelected(
      recentTalkToEntities,
      entity,
    );
    //otherwise open marketplace page
    if (!isRecentEntitySelected) {
      await this.searchOnMyAppButton();
      await marketplacePage.waitForPageLoaded(); // Wait for "My Applications" page to load
      //use application if it is visible on "My applications" tab
      const marketplaceContainer = marketplacePage.getMarketplaceContainer();
      const marketplace = marketplaceContainer.getMarketplace();
      const isMyApplicationUsed = await marketplace
        .getApplications()
        .isApplicationUsed(entity);
      //otherwise go to marketplace "Home page"
      if (!isMyApplicationUsed) {
        await marketplaceContainer
          .getMarketplaceSidebar()
          .homePageButton.click();
        await marketplacePage.waitForPageLoaded(); // Wait for "Home Page" to load
        const isAllApplicationUsed = await marketplace
          .getApplications()
          .isApplicationUsed(entity);
        if (!isAllApplicationUsed) {
          throw new Error(
            `Entity with name: ${entity.name} and version: ${entity.version ?? 'N/A'} is not found!`,
          );
        }
      }
    }
  }
  private async isEntitySelected(
    talkToEntities: TalkToEntities,
    entity: DialAIEntityModel,
  ): Promise<boolean> {
    let isEntitySelected = false;
    const entityLocator = talkToEntities.getTalkToEntity(entity);
    //select entity if it is visible
    if (await entityLocator.isVisible()) {
      await entityLocator
        .getChildElementBySelector(ChatSelectors.iconSelector)
        .click();
      isEntitySelected = true;
    } else {
      //if entity is not visible
      //check if entity name stays among visible entities
      const entityWithVersionToSetLocator =
        await talkToEntities.entityWithVersionToSet(entity);
      //select entity version if name is found
      if (entityWithVersionToSetLocator) {
        const isVersionSelected = await talkToEntities.selectEntityVersion(
          entityWithVersionToSetLocator,
          entity.version!,
        );
        if (isVersionSelected) {
          isEntitySelected = true;
        }
      }
    }
    return isEntitySelected;
  }
}
