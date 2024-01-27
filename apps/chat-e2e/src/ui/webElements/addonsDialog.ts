import { AddonDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { Page } from '@playwright/test';

export class AddonsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, AddonDialog.addonsDialog);
  }

  public searchResults = this.getChildElementBySelector(
    `${AddonDialog.addonSearchResults} >> ${Tags.button}`,
  );

  public closeButton = this.getChildElementBySelector(AddonDialog.closeDialog);

  public async getAddonsIcons() {
    return this.getElementIcons(this.searchResults, AddonDialog.addonName);
  }

  public async closeDialog() {
    await this.closeButton.click();
    await this.waitForState({ state: 'hidden' });
  }
}
