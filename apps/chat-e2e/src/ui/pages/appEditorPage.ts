import { AppsEditorTypes } from '@/src/testData';
import { BasePage } from '@/src/ui/pages/basePage';
import {
  AppEditorGeneralForm,
  AppEditorGeneralInfoAgentPreview,
  BaseAppEditorHeader,
  CustomAppEditorContainer,
} from '@/src/ui/webElements';

export class AppEditorPage extends BasePage {
  // Common elements - single instances shared by all containers
  private appEditorHeader!: BaseAppEditorHeader;
  private appEditorGeneralForm!: AppEditorGeneralForm;
  private appEditorGeneralInfoPreview!: AppEditorGeneralInfoAgentPreview;

  //declare specific app containers
  private customAppEditorContainer!: CustomAppEditorContainer;

  getAppEditorHeader(): BaseAppEditorHeader {
    if (!this.appEditorHeader) {
      this.appEditorHeader = new BaseAppEditorHeader(this.page);
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
  getAppEditorContainer(appType: AppsEditorTypes) {
    switch (appType) {
      case AppsEditorTypes.CustomApp:
        return this.getCustomAppEditorContainer();
      default:
        throw new Error(`Unsupported app type: ${appType}`);
    }
  }

  async waitForPageLoaded(appType: AppsEditorTypes) {
    const appEditorContainer = this.getAppEditorContainer(appType);
    const applicationGeneralForm = appEditorContainer.getAppEditorGeneralForm();
    const applicationPreview =
      appEditorContainer.getAppEditorGeneralInfoPreview();
    await appEditorContainer.getChatLoader().waitForState({ state: 'hidden' });
    await appEditorContainer.getHeader().waitForState();
    await applicationGeneralForm.waitForState();
    await applicationPreview.generalInfoContainer.waitForState();
  }

  async waitForPageLoadedForEdit(appType: AppsEditorTypes) {
    const appEditorContainer = this.getAppEditorContainer(appType);
    const applicationViewForm = appEditorContainer.getAppEditorViewForm();
    const applicationPreview =
      appEditorContainer.getAppEditorAppSettingsPreview();
    await appEditorContainer.getChatLoader().waitForState({ state: 'hidden' });
    await appEditorContainer.getHeader().waitForState();
    await applicationViewForm.waitForState();
    await applicationPreview.waitForState();
  }
}
