import { ElementState, ExpectedMessages } from '@/src/testData';
import { ShareModal } from '@/src/ui/webElements/shareModal';
import { expect } from '@playwright/test';

export class ShareModalAssertion {
  readonly shareModal: ShareModal;

  constructor(shareModal: ShareModal) {
    this.shareModal = shareModal;
  }

  public async assertModalState(expectedState: ElementState) {
    const modalLocator = this.shareModal.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(modalLocator, ExpectedMessages.modalWindowIsOpened)
          .toBeVisible()
      : await expect
          .soft(modalLocator, ExpectedMessages.modalWindowIsClosed)
          .toBeHidden();
  }

  public async assertMessageContent(expectedMessage: string) {
    expect
      .soft(
        await this.shareModal.getShareTextContent(),
        ExpectedMessages.sharedModalTextIsValid,
      )
      .toBe(expectedMessage);
  }
}
