import {
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
} from '@/src/testData';
import { PublicationReviewControl } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class PublicationReviewControlAssertion {
  readonly publicationReviewControl: PublicationReviewControl;

  constructor(publicationReviewControl: PublicationReviewControl) {
    this.publicationReviewControl = publicationReviewControl;
  }

  public async assertBackToPublicationRequestButtonState(
    expectedState: ElementState,
  ) {
    const buttonLocator =
      this.publicationReviewControl.backToPublicationRequestButton.getElementLocator();
    expectedState == 'visible'
      ? await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertNextButtonState(expectedState: ElementActionabilityState) {
    const buttonLocator =
      this.publicationReviewControl.nextButton.getElementLocator();
    expectedState == 'enabled'
      ? await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsEnabled)
          .toBeEnabled()
      : await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsDisabled)
          .toBeDisabled();
  }

  public async assertPreviousButtonState(
    expectedState: ElementActionabilityState,
  ) {
    const buttonLocator =
      this.publicationReviewControl.previousButton.getElementLocator();
    expectedState == 'enabled'
      ? await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsEnabled)
          .toBeEnabled()
      : await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsDisabled)
          .toBeDisabled();
  }
}
