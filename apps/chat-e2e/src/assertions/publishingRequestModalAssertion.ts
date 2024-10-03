import {
  ElementState,
  ExpectedMessages,
  PublishingExpectedMessages,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { PublishingRequestModal } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class PublishingRequestModalAssertion {
  readonly publishingRequestModal: PublishingRequestModal;

  constructor(publishingRequestModal: PublishingRequestModal) {
    this.publishingRequestModal = publishingRequestModal;
  }

  public async assertPublishingRequestModalState(expectedState: ElementState) {
    const publishingRequestModalElement =
      this.publishingRequestModal.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(
            publishingRequestModalElement,
            ExpectedMessages.modalWindowIsOpened,
          )
          .toBeVisible()
      : await expect
          .soft(
            publishingRequestModalElement,
            ExpectedMessages.modalWindowIsClosed,
          )
          .toBeHidden();
  }

  public async assertNoFilesRequestedToPublish() {
    await expect
      .soft(
        this.publishingRequestModal
          .getFilesToPublishTree()
          .noPublishingFilesMessage.getElementLocator(),
        PublishingExpectedMessages.noFilesToPublishRequested,
      )
      .toBeVisible();
  }

  public async assertSendRequestButtonIsDisabled() {
    await expect
      .soft(
        this.publishingRequestModal.sendRequestButton.getElementLocator(),
        ExpectedMessages.buttonIsDisabled,
      )
      .toBeDisabled();
    const buttonColor =
      await this.publishingRequestModal.sendRequestButton.getComputedStyleProperty(
        Styles.color,
      );
    expect
      .soft(buttonColor[0], ExpectedMessages.elementColorIsValid)
      .toBe(Colors.controlsTextDisable);
  }
}
