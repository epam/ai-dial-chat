import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { PromptPreviewModalWindow } from '@/src/ui/webElements/promptPreviewModalWindow';

export class PromptPreviewModalAssertion extends BaseAssertion {
  readonly promptPreviewModal: PromptPreviewModalWindow;

  constructor(promptPreviewModal: PromptPreviewModalWindow) {
    super();
    this.promptPreviewModal = promptPreviewModal;
  }

  public async assertPromptPreviewModalState(expectedState: ElementState) {
    await super.assertElementState(this.promptPreviewModal, expectedState); // Use base class method
  }

  public async assertPromptPreviewModalTitle(expectedValue: string) {
    await super.assertElementText(
      this.promptPreviewModal.modalTitle,
      expectedValue,
      ExpectedMessages.modalDialogTitleIsValid,
    ); // Use base class method
  }

  public async assertPromptName(expectedValue: string) {
    await super.assertElementText(
      this.promptPreviewModal.promptName,
      expectedValue,
      ExpectedMessages.promptNameValid,
    ); // Use base class method
  }

  public async assertPromptDescription(expectedValue: string | undefined) {
    if (expectedValue === '' || expectedValue === undefined) {
      await super.assertElementState(
        this.promptPreviewModal.promptDescription,
        'hidden',
        ExpectedMessages.promptDescriptionValid,
      );
    } else {
      await super.assertElementText(
        this.promptPreviewModal.promptDescription,
        expectedValue,
        ExpectedMessages.promptDescriptionValid,
      );
    }
  }

  public async assertPromptContent(expectedValue: string) {
    await super.assertElementText(
      this.promptPreviewModal.promptContent,
      expectedValue,
      ExpectedMessages.promptContentValid,
    );
  }
}
