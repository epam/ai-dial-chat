import { PopupSelectors } from '@/src/ui/selectors';
import { BaseElement, Button } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class Popup extends BaseElement {
  constructor(
    page: Page,
    selector = PopupSelectors.popupContainer,
    parentLocator?: Locator,
  ) {
    super(page, selector, parentLocator);
  }

  private closeButton!: Button;
  private cancelButton!: Button;

  getCloseButton(): Button {
    if (!this.closeButton) {
      this.closeButton = new Button(
        this.page,
        'Close dialog',
        this.rootLocator,
      );
    }
    return this.closeButton;
  }

  getCancelButton(): Button {
    if (!this.cancelButton) {
      this.cancelButton = new Button(this.page, 'Cancel', this.rootLocator);
    }
    return this.cancelButton;
  }

  public header = this.getChildElementBySelector(PopupSelectors.popupHeader);
  public content = this.getChildElementBySelector(PopupSelectors.popupContent);
}
