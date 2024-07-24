import { ExpectedMessages } from '@/src/testData';
import { ConfirmationDialog } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ConfirmationDialogAssertion {
  readonly confirmationDialog: ConfirmationDialog;

  constructor(confirmationDialog: ConfirmationDialog) {
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
    expect
      .soft(
        await this.confirmationDialog.getConfirmationMessage(),
        ExpectedMessages.confirmationMessageIsValid,
      )
      .toBe(expectedMessage);
  }
}
