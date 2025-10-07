import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
  ElementState,
  ExpectedConstants,
  ExpectedMessages,
  PublishingExpectedMessages,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { PublishingRequestDialog } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class PublishingRequestDialogAssertion extends BaseAssertion {
  readonly publishingRequestDialog: PublishingRequestDialog;

  constructor(publishingRequestDialog: PublishingRequestDialog) {
    super();
    this.publishingRequestDialog = publishingRequestDialog;
  }

  public async assertNoFilesRequestedToPublish() {
    await this.assertElementState(
      this.publishingRequestDialog.getFilesToPublishTree()
        .noPublishingFilesMessage,
      'visible',
      PublishingExpectedMessages.noFilesToPublishRequested,
    );
  }

  public async assertSendRequestButtonActionabilityState(
    expectedState: ElementActionabilityState,
  ) {
    await this.assertElementActionabilityState(
      this.publishingRequestDialog.sendRequestButton,
      expectedState,
    );

    if (expectedState === 'disabled') {
      const textColor =
        await this.publishingRequestDialog.sendRequestButton.getComputedStyleProperty(
          Styles.color,
        );
      expect
        .soft(textColor[0], ExpectedMessages.elementColorIsValid)
        .toBe(Colors.controlsTextDisable);
    } else {
      const backgroundColor =
        await this.publishingRequestDialog.sendRequestButton.getComputedStyleProperty(
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
  }) {
    if (fieldsToVerify.publishToLabel) {
      await this.assertElementState(
        this.publishingRequestDialog.publishToLabel,
        fieldsToVerify.publishToLabel,
      );
    }
    if (fieldsToVerify.publishTo) {
      await this.assertElementText(
        this.publishingRequestDialog.getChangePublishToPath().path,
        fieldsToVerify.publishTo,
      );
    }
    if (fieldsToVerify.authorLabel) {
      await this.assertElementState(
        this.publishingRequestDialog.authorLabel,
        fieldsToVerify.authorLabel,
      );
      fieldsToVerify.authorLabel === 'visible'
        ? await this.assertElementText(
            this.publishingRequestDialog.authorLabel,
            ExpectedConstants.authorLabel,
          )
        : await this.assertElementState(
            this.publishingRequestDialog.author,
            'hidden',
          );
    }
    if (fieldsToVerify.author) {
      await this.assertInputValue(
        this.publishingRequestDialog.author,
        fieldsToVerify.author,
      );
    }
    if (fieldsToVerify.unpublishFromLabel) {
      await this.assertElementState(
        this.publishingRequestDialog.unpublishFromLabel,
        fieldsToVerify.unpublishFromLabel,
      );
      await this.assertElementText(
        this.publishingRequestDialog.unpublishFromLabel,
        ExpectedConstants.unpublishFromLabel,
      );
    }
    if (fieldsToVerify.unpublishFrom) {
      await this.assertElementText(
        this.publishingRequestDialog.unpublishFrom,
        fieldsToVerify.unpublishFrom,
      );
    }
  }
}
