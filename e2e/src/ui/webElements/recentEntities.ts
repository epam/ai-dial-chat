import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement, EntityIcon } from './baseElement';

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
    await this.getRecentEntity(option).click();
  }

  public async getRecentEntityNames() {
    return this.recentEntityNames.getElementsInnerContent();
  }

  public async getRecentEntitiesIconAttributes() {
    const allIcons: EntityIcon[] = [];
    const entitiesCount = await this.recentEntities.getElementsCount();
    for (let i = 1; i <= entitiesCount; i++) {
      const entity = await this.recentEntities.getNthElement(i);
      const entityName = await entity
        .locator(ChatSelectors.recentEntityNames)
        .textContent();
      const iconHtml = await this.getElementIconHtml(entity);
      allIcons.push({ entityName: entityName!, icon: iconHtml });
    }
    return allIcons;
  }
}
