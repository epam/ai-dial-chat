import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class RecentEntities extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.recentEntities);
  }

  public recentEntityNames = this.getChildElementBySelector(
    ChatSelectors.recentEntityNames,
  );

  public getRecentEntity = (entity: string) =>
    this.createElementFromLocator(
      this.getChildElementBySelector(Tags.button).getElementLocatorByText(
        entity,
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
    await this.getRecentEntity(option).click();
  }

  public async getRecentEntityNames() {
    return this.recentEntityNames.getElementsInnerContent();
  }
}
