import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
  ElementState,
  ExpectedConstants,
  PublishingExpectedMessages,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { PublishingRequestDialog } from '@/src/ui/webElements';
import { ThemesUtil } from '@/src/utils/themesUtil';

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
      await this.assertElementBackgroundColors(
        this.publishingRequestDialog.sendRequestButton,
        ThemesUtil.getRgbColorByKey(
          ThemeColorAttributes.controlsBgSolidDisable,
        ),
      );
    } else {
      await this.assertElementBackgroundColors(
        this.publishingRequestDialog.sendRequestButton,
        ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgAccentPrimary),
      );
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
        this.publishingRequestDialog.publishPathLabel,
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
        this.publishingRequestDialog.publishPathLabel,
        fieldsToVerify.unpublishFromLabel,
      );
      await this.assertElementText(
        this.publishingRequestDialog.publishPathLabel,
        ExpectedConstants.unpublishFromLabel,
      );
    }
    if (fieldsToVerify.unpublishFrom) {
      await this.assertElementText(
        this.publishingRequestDialog.publishPath,
        fieldsToVerify.unpublishFrom,
      );
    }
  }
}
