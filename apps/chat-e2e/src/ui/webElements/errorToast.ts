import { Tags } from '@/src/ui/domData';
import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ErrorToast extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.errorToast);
  }

  public closeButton = this.getChildElementBySelector(Tags.button);

  public async closeToast() {
    if (await this.isVisible()) {
      await this.closeButton.click();
    }
  }
}
