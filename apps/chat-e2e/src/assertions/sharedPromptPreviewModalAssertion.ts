import { PromptPreviewModalAssertion } from '@/src/assertions/promptPreviewModalAssertion';
import { SharedPromptPreviewModal } from '@/src/ui/webElements';

export class SharedPromptPreviewModalAssertion extends PromptPreviewModalAssertion {
  readonly sharedPromptPreviewModal: SharedPromptPreviewModal;

  constructor(sharedPromptPreviewModal: SharedPromptPreviewModal) {
    super(sharedPromptPreviewModal);
    this.sharedPromptPreviewModal = sharedPromptPreviewModal;
  }

  public async assertExportButtonColors(expectedColor: string) {
    const exportButtonElement =
      this.sharedPromptPreviewModal.promptExportButtonIcon;
    await this.assertElementColor(exportButtonElement, expectedColor);
    await this.assertElementBorderColors(exportButtonElement, expectedColor);
  }

  public async assertDeleteButtonColors(expectedColor: string) {
    const deleteButtonElement =
      this.sharedPromptPreviewModal.promptDeleteButtonIcon;
    await this.assertElementColor(deleteButtonElement, expectedColor);
    await this.assertElementBorderColors(deleteButtonElement, expectedColor);
  }
}
