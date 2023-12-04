import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Locator, Page } from '@playwright/test';

export class MoreInfo extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.moreInfo, parentLocator);
  }

  public infoApplication = this.getChildElementBySelector(
    ChatSelectors.infoApplication,
  );

  public applicationDescription = this.getChildElementBySelector(
    ChatSelectors.description,
  );

  public async getApplicationDescription() {
    if (await this.applicationDescription.isVisible()) {
      return this.applicationDescription.getElementInnerContent();
    }
    return '';
  }
}
