import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { ConfirmationDialog } from '@/src/ui/webElements';

export class ConfirmationDialogAssertion extends BaseAssertion {
  readonly confirmationDialog: ConfirmationDialog;

  constructor(confirmationDialog: ConfirmationDialog) {
    super();
    this.confirmationDialog = confirmationDialog;
  }

  public async assertConfirmationDialogTitle(expectedTitle: string) {
    await this.assertElementText(
      this.confirmationDialog.entityName,
      expectedTitle,
      ExpectedMessages.modalDialogTitleIsValid,
    );
  }

  public async assertConfirmationMessage(expectedMessage: string) {
    await this.assertElementText(
      this.confirmationDialog.confirmMessage,
      expectedMessage,
      ExpectedMessages.confirmationMessageIsValid,
    );
  }
}
