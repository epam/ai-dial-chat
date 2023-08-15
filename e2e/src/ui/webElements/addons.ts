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

  public getAllAddons = this.getChildElementBySelector(
    `${ChatSelectors.addon} > ${Tags.button}`,
  );

  public getAddon = (name: string) =>
    this.getAllAddons.getElementLocatorByText(name);

  public seeAllAddonsButton = this.getChildElementBySelector(
    ChatSelectors.seeAllSelectors,
  );

  async getSelectedAddons() {
    return this.getAllAddons.getElementsInnerContent();
  }
}
