import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementState,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { ShareModal } from '@/src/ui/webElements/shareModal';

export class ShareModalAssertion<T extends ShareModal> extends BaseAssertion {
  readonly shareModal: T;

  constructor(shareModal: T) {
    super();
    this.shareModal = shareModal;
  }

  public async assertModalState(expectedState: ElementState) {
    await this.assertElementState(this.shareModal, expectedState);
  }

  public async assertMessageContent(expectedMessages: string[]) {
    await this.assertElementText(
      this.shareModal.shareText,
      expectedMessages,
      ExpectedMessages.sharedModalTextIsValid,
    );
  }

  public async assertGeneralInfo(fieldsToVerify: {
    entityName?: string;
    expectedMessages?: string[];
    qrCodeState?: ElementState;
    shareLinkInput?: ElementState;
    copyLinkButton?: ElementState;
    notSharedEntityLabel?: string;
  }) {
    if (fieldsToVerify.entityName) {
      await this.assertElementText(
        this.shareModal.entityName,
        ExpectedConstants.sharedEntityName(fieldsToVerify.entityName),
      );
    }
    if (fieldsToVerify.expectedMessages) {
      await this.assertMessageContent(fieldsToVerify.expectedMessages);
    }
    if (fieldsToVerify.qrCodeState) {
      await this.assertElementState(
        this.shareModal.shareQrCode,
        fieldsToVerify.qrCodeState,
      );
    }
    if (fieldsToVerify.shareLinkInput) {
      await this.assertElementState(
        this.shareModal.shareLinkInput,
        fieldsToVerify.shareLinkInput,
      );
    }
    if (fieldsToVerify.copyLinkButton) {
      await this.assertElementState(
        this.shareModal.copyLinkButton,
        fieldsToVerify.copyLinkButton,
      );
    }
    if (fieldsToVerify.notSharedEntityLabel) {
      await this.assertElementText(
        this.shareModal.notSharedEntityLabel,
        fieldsToVerify.notSharedEntityLabel,
      );
    }
  }
}
