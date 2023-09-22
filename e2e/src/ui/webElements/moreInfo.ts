import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class MoreInfo extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.moreInfo);
  }

  public infoApplication = this.getChildElementBySelector(
    ChatSelectors.infoApplication,
  );

  public applicationDescription = this.getChildElementBySelector(
    ChatSelectors.appDescr,
  );

  public async getApplicationDescription() {
    if (await this.applicationDescription.isVisible()) {
      return this.applicationDescription.getElementInnerContent();
    }
    return '';
  }
}
