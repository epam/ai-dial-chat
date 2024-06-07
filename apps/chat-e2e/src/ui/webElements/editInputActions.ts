import { EditSelectors } from '@/src/ui/selectors/editSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class EditInputActions extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, EditSelectors.actionButton, parentLocator);
  }

  public async clickTickButton() {
    await this.getNthElement(1).click();
  }

  public async clickCancelButton() {
    await this.getNthElement(2).click();
  }
}
