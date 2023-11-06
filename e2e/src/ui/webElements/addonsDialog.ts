import { AddonDialog, ChatSelectors } from '../selectors';
import { BaseElement, Icons } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
import { ModelsUtil } from '@/e2e/src/utils';
import { Page } from '@playwright/test';

export class AddonsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, AddonDialog.addonsDialog);
  }

  public searchResults = this.getChildElementBySelector(
    `${AddonDialog.addonSearchResults} >> ${Tags.button}`,
  );

  public closeButton = this.getChildElementBySelector(AddonDialog.closeDialog);

  public async getAddonsIconAttributes() {
    const allIcons: Icons[] = [];
    const addonsCount = await this.searchResults.getElementsCount();
    for (let i = 1; i <= addonsCount; i++) {
      const addon = await this.searchResults.getNthElement(i);
      const customIconAddon = await addon.locator(ChatSelectors.chatIcon);
      if (await customIconAddon.isVisible()) {
        const iconAttributes = await this.getElementIconAttributes(
          customIconAddon,
        );
        allIcons.push(iconAttributes);
      } else {
        const defaultIconEntity = await addon.locator(AddonDialog.addonName);
        const defaultIconEntityName = await defaultIconEntity.textContent();
        const defaultIconEntityId = ModelsUtil.getAddons().find(
          (e) => e.name === defaultIconEntityName,
        )!.id;
        allIcons.push({ iconEntity: defaultIconEntityId, iconUrl: undefined });
      }
    }
    return allIcons;
  }

  public async closeDialog() {
    await this.closeButton.click();
    await this.waitForState({ state: 'hidden' });
  }
}
