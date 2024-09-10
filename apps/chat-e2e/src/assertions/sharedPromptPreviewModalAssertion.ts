import { ElementState, ExpectedMessages } from '@/src/testData';
import { Styles } from '@/src/ui/domData';
import { SharedPromptPreviewModal } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class SharedPromptPreviewModalAssertion {
  readonly sharedPromptPreviewModal: SharedPromptPreviewModal;

  constructor(sharedPromptPreviewModal: SharedPromptPreviewModal) {
    this.sharedPromptPreviewModal = sharedPromptPreviewModal;
  }

  public async assertSharedPromptPreviewModalState(
    expectedState: ElementState,
  ) {
    const sharedPromptPreviewModal =
      this.sharedPromptPreviewModal.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(sharedPromptPreviewModal, ExpectedMessages.modalWindowIsOpened)
          .toBeVisible()
      : await expect
          .soft(sharedPromptPreviewModal, ExpectedMessages.modalWindowIsClosed)
          .toBeHidden();
  }

  public async assertSharedPromptPreviewModalTitle(expectedValue: string) {
    expect
      .soft(
        await this.sharedPromptPreviewModal.modalTitle.getElementInnerContent(),
        ExpectedMessages.modalDialogTitleIsValid,
      )
      .toBe(expectedValue);
  }

  public async assertSharedPromptName(expectedValue: string) {
    expect
      .soft(
        await this.sharedPromptPreviewModal.promptName.getElementInnerContent(),
        ExpectedMessages.promptNameValid,
      )
      .toBe(expectedValue);
  }

  public async assertSharedPromptDescription(
    expectedValue: string | undefined,
  ) {
    expectedValue === '' || expectedValue === undefined
      ? await expect
          .soft(
            this.sharedPromptPreviewModal.promptDescription.getElementLocator(),
            ExpectedMessages.promptDescriptionValid,
          )
          .toBeHidden()
      : expect
          .soft(
            await this.sharedPromptPreviewModal.promptDescription.getElementInnerContent(),
            ExpectedMessages.promptDescriptionValid,
          )
          .toBe(expectedValue);
  }

  public async assertSharedPromptContent(expectedValue: string) {
    expect
      .soft(
        await this.sharedPromptPreviewModal.promptContent.getElementInnerContent(),
        ExpectedMessages.promptContentValid,
      )
      .toBe(expectedValue);
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
