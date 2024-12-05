import { ElementState, ExpectedMessages } from '@/src/testData';
import { promptPreviewModal } from '@/src/ui/webElements/promptPreviewModal';
import { expect } from '@playwright/test';

export class PromptPreviewModalAssertion {
  readonly promptPreviewModal: promptPreviewModal;

  constructor(promptPreviewModal: promptPreviewModal) {
    this.promptPreviewModal = promptPreviewModal;
  }

  public async assertPromptPreviewModalState(expectedState: ElementState) {
    const promptPreviewModalLocator =
      this.promptPreviewModal.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(promptPreviewModalLocator, ExpectedMessages.modalWindowIsOpened)
          .toBeVisible()
      : await expect
          .soft(promptPreviewModalLocator, ExpectedMessages.modalWindowIsClosed)
          .toBeHidden();
  }

  public async assertPromptPreviewModalTitle(expectedValue: string) {
    expect
      .soft(
        await this.promptPreviewModal.modalTitle.getElementInnerContent(),
        ExpectedMessages.modalDialogTitleIsValid,
      )
      .toBe(expectedValue);
  }

  public async assertPromptName(expectedValue: string) {
    expect
      .soft(
        await this.promptPreviewModal.promptName.getElementInnerContent(),
        ExpectedMessages.promptNameValid,
      )
      .toBe(expectedValue);
  }

  public async assertPromptDescription(expectedValue: string | undefined) {
    expectedValue === '' || expectedValue === undefined
      ? await expect
          .soft(
            this.promptPreviewModal.promptDescription.getElementLocator(),
            ExpectedMessages.promptDescriptionValid,
          )
          .toBeHidden()
      : expect
          .soft(
            await this.promptPreviewModal.promptDescription.getElementInnerContent(),
            ExpectedMessages.promptDescriptionValid,
          )
          .toBe(expectedValue);
  }

  public async assertPromptContent(expectedValue: string) {
    expect
      .soft(
        await this.promptPreviewModal.promptContent.getElementInnerContent(),
        ExpectedMessages.promptContentValid,
      )
      .toBe(expectedValue);
  }
}
