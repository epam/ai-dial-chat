import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
  ExpectedMessages,
  PublishingExpectedMessages,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { PublishingRequestModal } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class PublishingRequestModalAssertion extends BaseAssertion {
  readonly publishingRequestModal: PublishingRequestModal;

  constructor(publishingRequestModal: PublishingRequestModal) {
    super();
    this.publishingRequestModal = publishingRequestModal;
  }

  public async assertNoFilesRequestedToPublish() {
    await this.assertElementState(
      this.publishingRequestModal.getFilesToPublishTree()
        .noPublishingFilesMessage,
      'visible',
      PublishingExpectedMessages.noFilesToPublishRequested,
    );
  }

  public async assertSendRequestButtonActionabilityState(
    expectedState: ElementActionabilityState,
  ) {
    await this.assertElementActionabilityState(
      this.publishingRequestModal.sendRequestButton,
      expectedState,
    );

    if (expectedState === 'disabled') {
      const textColor =
        await this.publishingRequestModal.sendRequestButton.getComputedStyleProperty(
          Styles.color,
        );
      expect
        .soft(textColor[0], ExpectedMessages.elementColorIsValid)
        .toBe(Colors.controlsTextDisable);
    } else {
      const backgroundColor =
        await this.publishingRequestModal.sendRequestButton.getComputedStyleProperty(
          Styles.backgroundColor,
        );
      expect
        .soft(backgroundColor[0], ExpectedMessages.buttonBackgroundColorIsValid)
        .toBe(Colors.textPermanent);
    }
  }

  public async assertSendRequestButtonIsDisabled() {
    await this.assertSendRequestButtonActionabilityState('disabled');
  }
}
