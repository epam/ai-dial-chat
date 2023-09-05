import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
import { AddonsDialog } from '@/e2e/src/ui/webElements/addonsDialog';
import { Page } from '@playwright/test';

export class Addons extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.addons);
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

  public seeAllAddonsButton = this.getChildElementBySelector(
    ChatSelectors.seeAllSelectors,
  );

  public async getSelectedAddons() {
    return this.selectedAddons.getElementsInnerContent();
  }

  public async getRecentAddons() {
    return this.recentAddons.getElementsInnerContent();
  }

  public async isAddonRemovable(addon: string) {
    return this.selectedAddon(addon)
      .locator(ChatSelectors.deleteAddonIcon)
      .isVisible();
  }

  public async seeAllAddons() {
    await this.seeAllAddonsButton.click();
  }
}
