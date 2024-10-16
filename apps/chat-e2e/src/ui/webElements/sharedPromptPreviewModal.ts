import { isApiStorageType } from '@/src/hooks/global-setup';
import { IconSelectors } from '@/src/ui/selectors';
import { PromptPreviewModal } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class SharedPromptPreviewModal extends BaseElement {
  constructor(page: Page) {
    super(page, PromptPreviewModal.promptPreviewModal);
  }

  public modalTitle = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewModalTitle,
  );
  public promptName = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewName,
  );
  public promptDescription = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewDescription,
  );
  public promptContent = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewContent,
  );
  public promptExportButton = this.getChildElementBySelector(
    PromptPreviewModal.promptExportButton,
  );
  public promptDeleteButton = this.getChildElementBySelector(
    PromptPreviewModal.promptDeleteButton,
  );
  public promptDuplicateButton = this.getChildElementBySelector(
    PromptPreviewModal.promptDuplicateButton,
  );
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

  public async duplicatePrompt({
    isHttpMethodTriggered = true,
  }: { isHttpMethodTriggered?: boolean } = {}) {
    await this.waitForState();
    if (isApiStorageType && isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST',
      );
      await this.promptDuplicateButton.click();
      return respPromise;
    }
    await this.promptDuplicateButton.click();
  }
}
