import { ElementState, ExpectedMessages } from '@/src/testData';
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

  public async assertSharedPromptDescription(expectedValue: string) {
    expect
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
}
