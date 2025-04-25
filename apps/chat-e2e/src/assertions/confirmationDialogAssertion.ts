import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { ConfirmationDialog } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ConfirmationDialogAssertion extends BaseAssertion {
  readonly confirmationDialog: ConfirmationDialog;

  constructor(confirmationDialog: ConfirmationDialog) {
    super();
    this.confirmationDialog = confirmationDialog;
  }

  public async assertConfirmationDialogTitle(expectedTitle: string) {
    expect
      .soft(
        await this.confirmationDialog.entityName.getElementInnerContent(),
        ExpectedMessages.modalDialogTitleIsValid,
      )
      .toBe(expectedTitle);
  }

  public async assertConfirmationMessage(expectedMessage: string) {
    await this.assertElementText(
      this.confirmationDialog.confirmMessage,
      expectedMessage,
    );
  }
}
