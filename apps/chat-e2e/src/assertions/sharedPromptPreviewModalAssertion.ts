import { PromptPreviewModalAssertion } from '@/src/assertions/promptPreviewModalAssertion';
import { ExpectedMessages } from '@/src/testData';
import { Styles } from '@/src/ui/domData';
import { SharedPromptPreviewModal } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class SharedPromptPreviewModalAssertion extends PromptPreviewModalAssertion {
  readonly sharedPromptPreviewModal: SharedPromptPreviewModal;

  constructor(sharedPromptPreviewModal: SharedPromptPreviewModal) {
    super(sharedPromptPreviewModal);
    this.sharedPromptPreviewModal = sharedPromptPreviewModal;
  }

  public async assertExportButtonColors(expectedColor: string) {
    const buttonColor =
      await this.sharedPromptPreviewModal.promptExportButton.getComputedStyleProperty(
        Styles.color,
      );
    const buttonBordersColor =
      await this.sharedPromptPreviewModal.promptExportButton.getAllBorderColors();

    expect
      .soft(buttonColor[0], ExpectedMessages.elementColorIsValid)
      .toBe(expectedColor);
    Object.values(buttonBordersColor).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.borderColorsAreValid)
          .toBe(expectedColor);
      });
    });
  }

  public async assertDeleteButtonColors(expectedColor: string) {
    const buttonColor =
      await this.sharedPromptPreviewModal.promptDeleteButton.getComputedStyleProperty(
        Styles.color,
      );
    const buttonBordersColor =
      await this.sharedPromptPreviewModal.promptDeleteButton.getAllBorderColors();

    expect
      .soft(buttonColor[0], ExpectedMessages.elementColorIsValid)
      .toBe(expectedColor);
    Object.values(buttonBordersColor).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.borderColorsAreValid)
          .toBe(expectedColor);
      });
    });
  }
}
