import { Popup } from '@/src/ui/selectors/dialogSelectors';
import { IconSelectors } from '@/src/ui/selectors/iconSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ErrorPopup extends BaseElement {
  constructor(page: Page) {
    super(page, Popup.errorPopup);
  }

  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );

  public async cancelPopup() {
    const isPopupVisible = await this.isVisible();
    if (isPopupVisible) {
      await this.cancelButton.click();
      await this.waitForState({ state: 'hidden' });
    }
  }
}
