import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
import { Page } from '@playwright/test';

export class AddonsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.addonsDialog);
  }

  public searchResults = this.getChildElementBySelector(
    `${ChatSelectors.addonSearchResults} >> ${Tags.button}`,
  );

  async getSearchResults() {
    return this.searchResults.getElementsInnerContent();
  }
}
