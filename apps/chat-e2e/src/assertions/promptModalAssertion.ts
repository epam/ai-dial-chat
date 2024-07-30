import { ExpectedMessages } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { PromptModalDialog } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class PromptModalAssertion {
  readonly promptModalDialog: PromptModalDialog;

  constructor(promptModalDialog: PromptModalDialog) {
    this.promptModalDialog = promptModalDialog;
  }

  public async assertNameFieldIsInvalid(expectedErrorMessage: string) {
    const nameBorderColors =
      await this.promptModalDialog.name.getAllBorderColors();
    Object.values(nameBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithRed)
          .toBe(Colors.textError);
      });
    });

    const nameFieldErrorMessage = this.promptModalDialog.getFieldBottomMessage(
      this.promptModalDialog.name,
    );
    await nameFieldErrorMessage.waitFor();

    await expect
      .soft(nameFieldErrorMessage, ExpectedMessages.promptNameInvalid)
      .toHaveText(expectedErrorMessage);
  }

  public async assertNameFieldIsEmpty() {
    expect
      .soft(
        await this.promptModalDialog.getName(),
        ExpectedMessages.charactersAreNotDisplayed,
      )
      .toBe('');
  }

  public async assertPromptNameIsValid(expectedPromptName: string) {
    expect
      .soft(
        await this.promptModalDialog.getName(),
        ExpectedMessages.promptNameValid,
      )
      .toBe(expectedPromptName);
  }
}
