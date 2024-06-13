import { isApiStorageType } from '@/src/hooks/global-setup';
import { ShareModalSelectors } from '@/src/ui/selectors';
import { ConfirmationDialogSelectors } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ConfirmationDialog extends BaseElement {
  constructor(page: Page) {
    super(page, ConfirmationDialogSelectors.container);
  }

  public cancelButton = new BaseElement(
    this.page,
    ConfirmationDialogSelectors.cancelDialog,
  );
  public confirmButton = new BaseElement(
    this.page,
    ConfirmationDialogSelectors.confirm,
  );
  public confirmMessage = new BaseElement(
    this.page,
    ConfirmationDialogSelectors.confirmationMessage,
  );
  public entityName = this.getChildElementBySelector(
    ShareModalSelectors.entityName,
  );

  public async cancelDialog() {
    await this.cancelButton.click();
  }

  public async confirm({
    triggeredHttpMethod = undefined,
  }: { triggeredHttpMethod?: 'PUT' | 'DELETE' | 'POST' } = {}) {
    if (isApiStorageType && triggeredHttpMethod) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === triggeredHttpMethod,
      );
      await this.confirmButton.click();
      return respPromise;
    }
    await this.confirmButton.click();
  }

  public async getConfirmationMessage() {
    return this.confirmMessage.getElementContent();
  }
}
