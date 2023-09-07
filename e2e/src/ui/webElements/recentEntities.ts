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
  public recentEntityDescriptions = this.getChildElementBySelector(
    ChatSelectors.recentEntityDescr,
  );

  public getRecentEntity = (entity: string) =>
    this.createElementFromLocator(
      this.getChildElementBySelector(Tags.button).getElementLocatorByText(
        entity,
      ),
    );

  public async selectEntity(option: string) {
    await this.getRecentEntity(option).click();
  }

  public async getRecentEntityNames() {
    return this.recentEntityNames.getElementsInnerContent();
  }
}
