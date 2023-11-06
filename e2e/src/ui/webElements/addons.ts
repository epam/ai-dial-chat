import { ChatSelectors } from '../selectors';
import { BaseElement, Icons } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
import { AddonsDialog } from '@/e2e/src/ui/webElements/addonsDialog';
import { ModelsUtil } from '@/e2e/src/utils';
import { Locator, Page } from '@playwright/test';

export class Addons extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.addons, parentLocator);
  }

  private addonsDialog!: AddonsDialog;

  getAddonsDialog(): AddonsDialog {
    if (!this.addonsDialog) {
      this.addonsDialog = new AddonsDialog(this.page);
    }
    return this.addonsDialog;
  }

  public selectedAddons = this.getChildElementBySelector(
    `${ChatSelectors.selectedAddons} >> ${Tags.button}`,
  );

  public selectedAddon = (addon: string) =>
    this.selectedAddons.getElementLocatorByText(addon);

  public recentAddons = this.getChildElementBySelector(
    `${ChatSelectors.recentAddons} >> ${Tags.button}`,
  );

  public recentAddon = (addon: string) =>
    this.recentAddons.getElementLocatorByText(addon);

  public seeAllAddonsButton = this.getChildElementBySelector(
    ChatSelectors.seeAllSelectors,
  );

  public async getSelectedAddons() {
    return this.selectedAddons.getElementsInnerContent();
  }

  public async getRecentAddons() {
    return this.recentAddons.getElementsInnerContent();
  }

  public async removeSelectedAddon(addon: string) {
    await this.selectedAddon(addon).click({ force: true });
  }

  public async selectAddon(addon: string) {
    await this.recentAddon(addon).click();
  }

  public async seeAllAddons() {
    await this.seeAllAddonsButton.click();
  }

  public async getAddonsIconAttributes(addons: BaseElement) {
    const allIcons: Icons[] = [];
    const addonsCount = await addons.getElementsCount();
    for (let i = 1; i <= addonsCount; i++) {
      const addon = await addons.getNthElement(i);
      const customAddonIcon = await addon.locator(ChatSelectors.chatIcon);
      if (await customAddonIcon.isVisible()) {
        const icon = await this.getElementIconAttributes(customAddonIcon);
        allIcons.push(icon);
      } else {
        const addonName = await addon.textContent();
        const defaultIconAddonId = ModelsUtil.getAddons().find(
          (a) => a.name === addonName,
        )!.id;
        allIcons.push({ iconEntity: defaultIconAddonId, iconUrl: undefined });
      }
    }
    return allIcons;
  }

  public async getRecentAddonsIconAttributes() {
    return this.getAddonsIconAttributes(this.recentAddons);
  }

  public async getSelectedAddonsIconAttributes() {
    return this.getAddonsIconAttributes(this.selectedAddons);
  }
}
