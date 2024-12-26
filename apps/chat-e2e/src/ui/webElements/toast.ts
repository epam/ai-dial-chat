import { Tags } from '@/src/ui/domData';
import { ToastSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Toast extends BaseElement {
  constructor(page: Page) {
    super(page, ToastSelectors.toast);
  }

  public closeButton = this.getChildElementBySelector(Tags.button);

  public async closeToast() {
    if (await this.isVisible()) {
      await this.closeButton.click();
    }
  }
}
