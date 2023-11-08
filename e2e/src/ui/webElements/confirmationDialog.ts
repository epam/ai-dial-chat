import { Dialog } from '@/e2e/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ConfirmationDialog extends BaseElement {
  constructor(page: Page) {
    super(page, Dialog.confirmationDialog);
  }

  public cancelButton = new BaseElement(this.page, Dialog.cancelDialog);
  public confirmButton = new BaseElement(this.page, Dialog.confirm);
  public confirmMessage = new BaseElement(
    this.page,
    Dialog.confirmationMessage,
  );

  public async cancelDialog() {
    await this.cancelButton.click();
  }

  public async confirm() {
    await this.confirmButton.click();
  }

  public async getConfirmationMessage() {
    return this.confirmMessage.getElementContent();
  }
}
