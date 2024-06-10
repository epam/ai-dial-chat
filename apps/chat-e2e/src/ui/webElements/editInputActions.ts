import { EditSelectors } from '@/src/ui/selectors/editSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class EditInputActions extends BaseElement {
  constructor(page: Page, parentLocator: Locator, selector: string) {
    super(
      page,
      `${selector} >> ${EditSelectors.actionsContainer}`,
      parentLocator,
    );
  }

  public async clickTickButton() {
    await this.getChildElementBySelector(EditSelectors.confirmEdit).click();
  }

  public async clickCancelButton() {
    await this.getChildElementBySelector(EditSelectors.cancelEdit).click();
  }
}
