import { BaseAssertion } from '@/src/assertions';
import { ElementActionabilityState } from '@/src/testData';
import { PublicationReviewControl } from '@/src/ui/webElements';

export class PublicationReviewControlAssertion extends BaseAssertion {
  readonly publicationReviewControl: PublicationReviewControl;

  constructor(publicationReviewControl: PublicationReviewControl) {
    super();
    this.publicationReviewControl = publicationReviewControl;
  }

  public async assertButtonsState(buttonsToVerify: {
    backToPublicationRequestButtonState?: ElementActionabilityState;
    nextButtonState?: ElementActionabilityState;
    previousButtonState?: ElementActionabilityState;
  }) {
    if (buttonsToVerify.backToPublicationRequestButtonState) {
      await this.assertElementActionabilityState(
        this.publicationReviewControl.backToPublicationRequestButton,
        buttonsToVerify.backToPublicationRequestButtonState,
      );
    }
    if (buttonsToVerify.nextButtonState) {
      await this.assertElementActionabilityState(
        this.publicationReviewControl.nextButton,
        buttonsToVerify.nextButtonState,
      );
    }
    if (buttonsToVerify.previousButtonState) {
      await this.assertElementActionabilityState(
        this.publicationReviewControl.previousButton,
        buttonsToVerify.previousButtonState,
      );
    }
  }
}
