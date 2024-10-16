import { ChatSettingsSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { Locator, Page } from '@playwright/test';

export class MoreInfo extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsSelectors.moreInfo, parentLocator);
  }
  public entityInfo = this.getChildElementBySelector(
    ChatSettingsSelectors.entityInfo,
  );

  public entityDescription = this.getChildElementBySelector(
    ChatSettingsSelectors.entityDescription,
  );
  public entityIcon = this.getChildElementBySelector(Tags.img);

  async getEntityIcon() {
    await this.entityIcon.waitForState();
    return this.getElementIconHtml(this.rootLocator);
  }

  public async getEntityDescription() {
    if (await this.entityDescription.isVisible()) {
      return this.entityDescription.getElementInnerContent();
    }
    return '';
  }

  public async getEntityName() {
    return this.entityInfo
      .getElementLocator()
      .locator(Tags.span)
      .last()
      .textContent();
  }
}
