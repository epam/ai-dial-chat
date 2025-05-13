import { isApiStorageType } from '@/src/hooks/global-setup';
import { Tags } from '@/src/ui/domData';
import { PromptPreviewModal } from '@/src/ui/selectors/dialogSelectors';
import { PromptPreviewModalWindow } from '@/src/ui/webElements/promptPreviewModalWindow';

export class SharedPromptPreviewModal extends PromptPreviewModalWindow {
  public promptDescription = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewDescription,
  );
  public promptDeleteButton = this.getChildElementBySelector(
    PromptPreviewModal.promptDeleteButton,
  );
  public promptDeleteButtonIcon =
    this.promptDeleteButton.getChildElementBySelector(Tags.svg);
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
