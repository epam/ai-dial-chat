import { AppEditorAppTypes } from '@/src/testData';
import { BasePage } from '@/src/ui/pages/basePage';
import {
  AppEditorGeneralForm,
  AppEditorGeneralInfoAgentPreview,
  AppEditorHeader,
  CustomAppEditorContainer,
} from '@/src/ui/webElements';

export class AppEditorPage extends BasePage {
  // Common elements - single instances shared by all containers
  private appEditorHeader!: AppEditorHeader;
  private appEditorGeneralForm!: AppEditorGeneralForm;
  private appEditorGeneralInfoPreview!: AppEditorGeneralInfoAgentPreview;

  //declare specific app containers
  private customAppEditorContainer!: CustomAppEditorContainer;

  getAppEditorHeader(): AppEditorHeader {
    if (!this.appEditorHeader) {
      this.appEditorHeader = new AppEditorHeader(this.page);
    }
    return this.appEditorHeader;
  }

  getAppEditorGeneralForm(): AppEditorGeneralForm {
    if (!this.appEditorGeneralForm) {
      this.appEditorGeneralForm = new AppEditorGeneralForm(this.page);
    }
    return this.appEditorGeneralForm;
  }

  getAppEditorGeneralInfoPreview(): AppEditorGeneralInfoAgentPreview {
    if (!this.appEditorGeneralInfoPreview) {
      this.appEditorGeneralInfoPreview = new AppEditorGeneralInfoAgentPreview(
        this.page,
      );
    }
    return this.appEditorGeneralInfoPreview;
  }

  //init specific app type
  getCustomAppEditorContainer(): CustomAppEditorContainer {
    if (!this.customAppEditorContainer) {
      this.customAppEditorContainer = new CustomAppEditorContainer(
        this.page,
        this.getAppEditorHeader(),
        this.getAppEditorGeneralForm(),
        this.getAppEditorGeneralInfoPreview(),
      );
    }
    return this.customAppEditorContainer;
  }

  //get generic container based on app type
  getAppEditorContainer(appType: AppEditorAppTypes) {
    switch (appType) {
      case AppEditorAppTypes.CustomApp:
        return this.getCustomAppEditorContainer();
      default:
        throw new Error(`Unsupported app type: ${appType}`);
    }
  }

  async waitForPageLoaded(appType: AppEditorAppTypes) {
    const appEditorContainer = await this.waitForAppEditorLoaded(appType);
    const applicationGeneralForm = appEditorContainer.getAppEditorGeneralForm();
    const applicationPreview =
      appEditorContainer.getAppEditorGeneralInfoPreview();
    await Promise.all([
      applicationGeneralForm.waitForState(),
      applicationPreview.getAppEditorPreviewCard().waitForState(),
    ]);
  }

  async waitForPageLoadedForEdit(appType: AppEditorAppTypes) {
    const appEditorContainer = await this.waitForAppEditorLoaded(appType);
    const applicationViewForm = appEditorContainer.getAppEditorViewForm();
    const applicationPreview =
      appEditorContainer.getAppEditorAppSettingsPreview();
    await Promise.all([
      applicationViewForm.waitForState(),
      applicationPreview.waitForState(),
    ]);
  }

  private async waitForAppEditorLoaded(appType: AppEditorAppTypes) {
    const appEditorContainer = this.getAppEditorContainer(appType);
    await Promise.all([
      appEditorContainer.getChatLoader().waitForState({ state: 'hidden' }),
      appEditorContainer.getHeader().waitForState(),
    ]);
    return appEditorContainer;
  }
}
