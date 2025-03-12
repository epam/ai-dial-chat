import { BasePage } from '@/src/ui/pages/basePage';
import { AppEditorContainer } from '@/src/ui/webElements/appEditor/appEditorContainer';

export class AppEditorPage extends BasePage {
  private appEditorContainer!: AppEditorContainer;

  getAppEditorContainer() {
    if (!this.appEditorContainer) {
      this.appEditorContainer = new AppEditorContainer(this.page);
    }
    return this.appEditorContainer;
  }

  async waitForPageLoaded() {
    const appEditorContainer = this.getAppEditorContainer();
    const applicationGeneralForm = appEditorContainer.getAppEditorGeneralForm();
    const applicationPreview = appEditorContainer.getAppEditorPreview();
    await this.appEditorContainer
      .getChatLoader()
      .waitForState({ state: 'hidden' });
    await appEditorContainer.getAppEditorHeader().waitForState();
    await applicationGeneralForm.waitForState();
    await applicationPreview.waitForState();
  }
}
