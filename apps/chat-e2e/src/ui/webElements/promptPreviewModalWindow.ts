import { Tags } from '@/src/ui/domData';
import { IconSelectors } from '@/src/ui/selectors';
import { PromptPreviewModal } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class PromptPreviewModalWindow extends BaseElement {
  constructor(page: Page) {
    super(page, PromptPreviewModal.promptPreviewModal);
  }

  public modalTitle = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewModalTitle,
  );
  public promptDescription = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewDescription,
  );
  public promptName = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewName,
  );
  public promptContent = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewContent,
  );
  public promptExportButton = this.getChildElementBySelector(
    PromptPreviewModal.promptExportButton,
  );
  public promptExportButtonIcon =
    this.promptExportButton.getChildElementBySelector(Tags.svg);
  public editPromptButton = this.getChildElementBySelector(
    PromptPreviewModal.editPromptButton,
  );
  public usePromptButton = this.getChildElementBySelector(
    PromptPreviewModal.usePromptButton,
  );
  public promptInfoButton = this.getChildElementBySelector(
    PromptPreviewModal.promptInfoButton,
  );
  public version = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewVersion,
  );
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

  public async openPromptInfo() {
    const respPromise = this.page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.status() === 200,
    );
    await this.promptInfoButton.click();
    await respPromise;
  }
}
