import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Locator, Page } from '@playwright/test';

export class RecentEntities extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.recentEntities, parentLocator);
  }

  public recentEntityNames = this.getChildElementBySelector(
    ChatSelectors.recentEntityNames,
  );

  public recentEntities = this.getChildElementBySelector(Tags.button);

  public getRecentEntity = (entity: string) =>
    this.createElementFromLocator(
      this.recentEntities.getElementLocatorByText(
        new RegExp(`^${entity}$`, 'g'),
      ),
    );

  public recentEntityDescription = (entity: string) =>
    this.getRecentEntity(entity).getChildElementBySelector(
      ChatSelectors.recentEntityDescr,
    );

  public async getRecentEntityDescription(entity: string) {
    if (await this.recentEntityDescription(entity).isVisible()) {
      return this.recentEntityDescription(entity).getElementInnerContent();
    }
    return '';
  }

  public async selectEntity(option: string) {
    await this.getRecentEntity(option).click({ force: true });
  }

  public async getRecentEntityNames() {
    return this.recentEntityNames.getElementsInnerContent();
  }

  public async getRecentEntitiesIcons() {
    return this.getElementIcons(
      this.recentEntities,
      ChatSelectors.recentEntityNames,
    );
  }
}
