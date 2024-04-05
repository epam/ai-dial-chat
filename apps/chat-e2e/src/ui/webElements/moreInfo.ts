import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { Locator, Page } from '@playwright/test';

export class MoreInfo extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.moreInfo, parentLocator);
  }
  public entityInfo = this.getChildElementBySelector(ChatSelectors.entityInfo);

  public entityDescription = this.getChildElementBySelector(
    ChatSelectors.description,
  );
  public entityIcon = this.getChildElementBySelector(Tags.svg);

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
}
