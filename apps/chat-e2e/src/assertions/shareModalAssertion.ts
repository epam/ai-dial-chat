import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementState,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
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
    qrCodeLink?: string;
    shareLinkInput?: ElementState;
    copyLinkButton?: ElementState;
    notSharedEntityLabel?: string;
    removeAccessBtnState?: ElementState;
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
        this.shareModal.shareQrCodeContainer,
        fieldsToVerify.qrCodeState,
      );
      await this.assertElementState(
        this.shareModal.shareQrCodeImage,
        fieldsToVerify.qrCodeState,
      );
    }
    if (fieldsToVerify.qrCodeLink) {
      await this.assertElementAttribute(
        this.shareModal.shareQrCodeContainer,
        Attributes.ariaDetails,
        fieldsToVerify.qrCodeLink,
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
    if (fieldsToVerify.removeAccessBtnState) {
      await this.assertElementState(
        this.shareModal.removeAccessBtn,
        fieldsToVerify.removeAccessBtnState,
      );
    }
  }
}
