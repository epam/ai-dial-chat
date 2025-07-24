import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
  ElementState,
  ExpectedConstants,
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

  public async assertGeneralInfo(fieldsToVerify: {
    publishToLabel?: ElementState;
    publishTo?: string;
    authorLabel?: ElementState;
    author?: string;
    unpublishFromLabel?: ElementState;
    unpublishFrom?: string;
    allowAccessLabel?: ElementState;
    availabilityLabel?: ElementState;
  }) {
    if (fieldsToVerify.publishToLabel) {
      await this.assertElementState(
        this.publishingRequestModal.publishToLabel,
        fieldsToVerify.publishToLabel,
      );
    }
    if (fieldsToVerify.publishTo) {
      await this.assertElementText(
        this.publishingRequestModal.getChangePublishToPath().path,
        fieldsToVerify.publishTo,
      );
    }
    if (fieldsToVerify.authorLabel) {
      await this.assertElementState(
        this.publishingRequestModal.authorLabel,
        fieldsToVerify.authorLabel,
      );
      fieldsToVerify.authorLabel === 'visible'
        ? await this.assertElementText(
            this.publishingRequestModal.authorLabel,
            ExpectedConstants.authorLabel,
          )
        : await this.assertElementState(
            this.publishingRequestModal.author,
            'hidden',
          );
    }
    if (fieldsToVerify.author) {
      await this.assertInputValue(
        this.publishingRequestModal.author,
        fieldsToVerify.author,
      );
    }
    if (fieldsToVerify.unpublishFromLabel) {
      await this.assertElementState(
        this.publishingRequestModal.unpublishFromLabel,
        fieldsToVerify.unpublishFromLabel,
      );
      await this.assertElementText(
        this.publishingRequestModal.unpublishFromLabel,
        ExpectedConstants.unpublishFromLabel,
      );
    }
    if (fieldsToVerify.unpublishFrom) {
      await this.assertElementText(
        this.publishingRequestModal.unpublishFrom,
        fieldsToVerify.unpublishFrom,
      );
    }
    if (fieldsToVerify.allowAccessLabel) {
      await this.assertElementState(
        this.publishingRequestModal.allowAccessLabel,
        fieldsToVerify.allowAccessLabel,
      );
      if (fieldsToVerify.allowAccessLabel === 'visible') {
        await this.assertElementText(
          this.publishingRequestModal.allowAccessLabel,
          ExpectedConstants.allowAccessLabel,
        );
      }
    }
    if (fieldsToVerify.availabilityLabel) {
      await this.assertElementState(
        this.publishingRequestModal.availabilityLabel,
        fieldsToVerify.availabilityLabel,
      );
      if (fieldsToVerify.availabilityLabel === 'visible') {
        await this.assertElementText(
          this.publishingRequestModal.availabilityLabel,
          ExpectedConstants.availabilityLabel,
        );
      }
    }
  }
}
