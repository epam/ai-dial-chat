import { ChatSelectors } from '@/src/ui/selectors';
import { AppEditorGeneralForm, BaseElement } from '@/src/ui/webElements';
import { AppEditorAppSettingsAgentPreview } from '@/src/ui/webElements/appEditor/appEditorAppSettingsAgentPreview';
import { AppEditorGeneralInfoAgentPreview } from '@/src/ui/webElements/appEditor/appEditorGeneralInfoAgentPreview';
import { AppEditorHeader } from '@/src/ui/webElements/appEditor/appEditorHeader';
import { AppEditorViewForm } from '@/src/ui/webElements/appEditor/appEditorViewForm';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';

export class AppEditorContainer extends BaseLayoutContainer<AppEditorHeader> {
  private appEditorHeader!: AppEditorHeader;
  private appEditorGeneralForm!: AppEditorGeneralForm;
  private appEditorViewForm!: AppEditorViewForm;
  private appEditorGeneralInfoPreview!: AppEditorGeneralInfoAgentPreview;
  private appEditorAppSettingsPreview!: AppEditorAppSettingsAgentPreview;

  getHeader(): AppEditorHeader {
    if (!this.header) {
      this.header = new AppEditorHeader(this.page, this.rootLocator);
    }
    return this.header;
  }

  getAppEditorHeader(): AppEditorHeader {
    if (!this.appEditorHeader) {
      this.appEditorHeader = new AppEditorHeader(this.page, this.rootLocator);
    }
    return this.appEditorHeader;
  }

  getAppEditorGeneralForm(): AppEditorGeneralForm {
    if (!this.appEditorGeneralForm) {
      this.appEditorGeneralForm = new AppEditorGeneralForm(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorGeneralForm;
  }

  getAppEditorViewForm(): AppEditorViewForm {
    if (!this.appEditorViewForm) {
      this.appEditorViewForm = new AppEditorViewForm(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorViewForm;
  }

  getAppEditorGeneralInfoPreview(): AppEditorGeneralInfoAgentPreview {
    if (!this.appEditorGeneralInfoPreview) {
      this.appEditorGeneralInfoPreview = new AppEditorGeneralInfoAgentPreview(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorGeneralInfoPreview;
  }

  getAppEditorAppSettingsPreview(): AppEditorAppSettingsAgentPreview {
    if (!this.appEditorAppSettingsPreview) {
      this.appEditorAppSettingsPreview = new AppEditorAppSettingsAgentPreview(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorAppSettingsPreview;
  }

  getChatLoader(): BaseElement {
    return this.getChildElementBySelector(ChatSelectors.messageSpinner);
  }
}
