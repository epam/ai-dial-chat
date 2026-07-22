import { API } from '@/src/testData';
import { DislikeCommentModalSelectors } from '@/src/ui/selectors';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Page } from '@playwright/test';

export class DislikeCommentModal extends Popup {
  constructor(page: Page) {
    super(page, DislikeCommentModalSelectors.modal);
  }

  public title = this.getChildElementBySelector(
    DislikeCommentModalSelectors.title,
  );
  public commentInput = this.getChildElementBySelector(
    DislikeCommentModalSelectors.commentInput,
  );
  public sendButton = this.getChildElementBySelector(
    DislikeCommentModalSelectors.sendButton,
  );

  public async typeComment(comment: string) {
    await this.commentInput.fillInInput(comment);
  }

  public async sendComment() {
    const respPromise = this.page.waitForResponse(
      (resp) =>
        resp.request().method() === 'POST' &&
        resp.url().includes(API.rateHost) &&
        resp.status() === 200,
    );
    await this.sendButton.click();
    return respPromise;
  }

  public async close() {
    await this.getCloseButton().click();
  }
}
