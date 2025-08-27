import { AddonDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { Page } from '@playwright/test';

export class AddonsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, AddonDialog.addonsDialog);
  }

  public addons = this.getChildElementBySelector(
    `${Tags.button}:has(${AddonDialog.addonName})`,
  );

  public searchResults = this.getChildElementBySelector(
    `${AddonDialog.addonSearchResults} >> ${Tags.button}`,
  );

  public closeButton = this.getChildElementBySelector(AddonDialog.closeDialog);

  public applyAddonsButton = this.getChildElementBySelector(
    AddonDialog.applyAddons,
  );

  public async getAddonsIcons() {
    return this.getElementIcons(this.searchResults);
  }

  public async selectAddon(name: string | number) {
    if (this.addons) {
      typeof name === 'string'
        ? await this.addons.getElementLocatorByText(name).click()
        : await this.addons.getNthElement(name).click();
    }
  }

  public async closeDialog() {
    await this.closeButton.click();
    await this.waitForState({ state: 'hidden' });
  }
}
