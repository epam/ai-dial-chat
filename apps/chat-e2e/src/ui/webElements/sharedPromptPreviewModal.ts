import { isApiStorageType } from '@/src/hooks/global-setup';
import { PromptPreviewModal } from '@/src/ui/selectors/dialogSelectors';
import { promptPreviewModal } from '@/src/ui/webElements/promptPreviewModal';

export class SharedPromptPreviewModal extends promptPreviewModal {
  public promptDescription = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewDescription,
  );
  public promptDeleteButton = this.getChildElementBySelector(
    PromptPreviewModal.promptDeleteButton,
  );
  public promptDuplicateButton = this.getChildElementBySelector(
    PromptPreviewModal.promptDuplicateButton,
  );

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
