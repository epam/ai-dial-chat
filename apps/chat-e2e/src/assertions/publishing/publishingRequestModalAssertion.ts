import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages, PublishingExpectedMessages } from '@/src/testData';
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

  public async assertSendRequestButtonIsDisabled() {
    await this.assertElementActionabilityState(
      this.publishingRequestModal.sendRequestButton,
      'disabled',
    );
    const buttonColor =
      await this.publishingRequestModal.sendRequestButton.getComputedStyleProperty(
        Styles.color,
      );
    expect
      .soft(buttonColor[0], ExpectedMessages.elementColorIsValid)
      .toBe(Colors.controlsTextDisable);
  }
}
