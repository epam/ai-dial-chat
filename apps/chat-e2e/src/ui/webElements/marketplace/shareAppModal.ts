import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { ShareModalSelectors } from '@/src/ui/selectors';
import { ShareModal } from '@/src/ui/webElements/shareModal';

export class ShareAppModal extends ShareModal {
  public shareOption = this.getChildElementBySelector(
    ShareModalSelectors.shareOption,
  );
  public shareOptionCheckbox = this.shareOption.getChildElementBySelector(
    Tags.input,
  );
  public appVersion = this.getChildElementBySelector(
    ShareModalSelectors.entityVersion,
  );

  public async checkAllowEditingByOtherUsers() {
    const respPromise = this.page.waitForResponse(
      (resp) =>
        resp.request().method() === 'POST' &&
        resp.url().includes(API.shareEntityHost) &&
        resp.status() === 200,
    );
    await this.shareOptionCheckbox.click();
    await respPromise;
  }
}
