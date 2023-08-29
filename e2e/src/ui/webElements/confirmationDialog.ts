import { ClearConversationsDialog } from '@/e2e/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ConfirmationDialog extends BaseElement {
  constructor(page: Page) {
    super(page, ClearConversationsDialog.clearConversationsDialog);
  }

  public cancelButton = new BaseElement(
    this.page,
    ClearConversationsDialog.cancelDialog,
  );
  public confirmButton = new BaseElement(
    this.page,
    ClearConversationsDialog.confirm,
  );

  public async cancelDialog() {
    await this.cancelButton.click();
  }

  public async confirm() {
    await this.confirmButton.click();
  }
}
