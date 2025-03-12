import { isApiStorageType } from '@/src/hooks/global-setup';
import { ShareModalSelectors } from '@/src/ui/selectors';
import { ConfirmationDialogSelectors } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ConfirmationDialog extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, ConfirmationDialogSelectors.container, parentLocator);
  }

  public cancelButton = this.getChildElementBySelector(
    ConfirmationDialogSelectors.cancelDialog,
  );
  public confirmButton = this.getChildElementBySelector(
    ConfirmationDialogSelectors.confirm,
  );
  public confirmMessage = this.getChildElementBySelector(
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
