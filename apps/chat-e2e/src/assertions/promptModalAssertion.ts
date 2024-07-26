import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { PromptModalDialog } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class PromptModalAssertion {
  readonly promptModalDialog: PromptModalDialog;

  constructor(promptModalDialog: PromptModalDialog) {
    this.promptModalDialog = promptModalDialog;
  }

  public async assertNameFieldIsInvalid() {
    const nameBorderColors =
      await this.promptModalDialog.name.getAllBorderColors();
    Object.values(nameBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithRed)
          .toBe(Colors.textError);
      });
    });

    await this.promptModalDialog
      .getFieldBottomMessage(this.promptModalDialog.name)
      .waitFor();

    await expect
      .soft(
        this.promptModalDialog.getFieldBottomMessage(
          this.promptModalDialog.name,
        ),
        ExpectedMessages.promptNameInvalid,
      )
      .toHaveText(ExpectedConstants.nameWithDotErrorMessage);
  }
}
