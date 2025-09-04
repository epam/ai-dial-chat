import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { ShareModal } from '@/src/ui/webElements/shareModal';

export class ShareModalAssertion extends BaseAssertion {
  readonly shareModal: ShareModal;

  constructor(shareModal: ShareModal) {
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
}
