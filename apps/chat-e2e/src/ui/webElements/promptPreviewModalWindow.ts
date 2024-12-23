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
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
}
