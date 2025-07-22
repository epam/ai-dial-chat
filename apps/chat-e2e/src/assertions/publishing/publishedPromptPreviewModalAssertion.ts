import { PromptPreviewModalAssertion } from '@/src/assertions/promptPreviewModalAssertion';
import { ElementActionabilityState } from '@/src/testData';
import { PublishedPromptPreviewModal } from '@/src/ui/webElements/publishedPromptPreviewModal';

export class PublishedPromptPreviewModalAssertion extends PromptPreviewModalAssertion {
  readonly publishedPromptPreviewModal: PublishedPromptPreviewModal;

  constructor(publishedPromptPreviewModal: PublishedPromptPreviewModal) {
    super(publishedPromptPreviewModal);
    this.publishedPromptPreviewModal = publishedPromptPreviewModal;
  }

  public async assertButtonsState(buttonsToVerify: {
    backToPublicationRequestButtonState?: ElementActionabilityState;
    nextButtonState?: ElementActionabilityState;
    previousButtonState?: ElementActionabilityState;
  }) {
    const publicationReviewControl =
      this.publishedPromptPreviewModal.getPublicationReviewControl();
    if (buttonsToVerify.backToPublicationRequestButtonState) {
      await this.assertElementActionabilityState(
        publicationReviewControl.backToPublicationRequestButton,
        buttonsToVerify.backToPublicationRequestButtonState,
      );
    }
    if (buttonsToVerify.nextButtonState) {
      await this.assertElementActionabilityState(
        publicationReviewControl.nextButton,
        buttonsToVerify.nextButtonState,
      );
    }
    if (buttonsToVerify.previousButtonState) {
      await this.assertElementActionabilityState(
        publicationReviewControl.previousButton,
        buttonsToVerify.previousButtonState,
      );
    }
  }
}
