import { AddonDialog } from '../selectors';
import { BaseElement, EntityIcon } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
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
    const allIcons: EntityIcon[] = [];
    const addonsCount = await this.searchResults.getElementsCount();
    for (let i = 1; i <= addonsCount; i++) {
      const addon = await this.searchResults.getNthElement(i);
      const addonName = await addon
        .locator(AddonDialog.addonName)
        .textContent();
      const iconHtml = await this.getElementIconHtml(addon);
      allIcons.push({ entityName: addonName!, icon: iconHtml });
    }
    return allIcons;
  }

  public async closeDialog() {
    await this.closeButton.click();
    await this.waitForState({ state: 'hidden' });
  }
}
