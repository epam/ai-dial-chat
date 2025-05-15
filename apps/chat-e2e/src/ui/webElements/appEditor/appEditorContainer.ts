import { ChatSelectors } from '@/src/ui/selectors';
import { AppEditorGeneralForm, BaseElement } from '@/src/ui/webElements';
import { AppEditorAppSettingsPreview } from '@/src/ui/webElements/appEditor/appEditorAppSettingsPreview';
import { AppEditorGeneralInfoPreview } from '@/src/ui/webElements/appEditor/appEditorGeneralInfoPreview';
import { AppEditorHeader } from '@/src/ui/webElements/appEditor/appEditorHeader';
import { AppEditorViewForm } from '@/src/ui/webElements/appEditor/appEditorViewForm';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';

export class AppEditorContainer extends BaseLayoutContainer<AppEditorHeader> {
  private appEditorHeader!: AppEditorHeader;
  private appEditorGeneralForm!: AppEditorGeneralForm;
  private appEditorViewForm!: AppEditorViewForm;
  private appEditorGeneralInfoPreview!: AppEditorGeneralInfoPreview;
  private appEditorAppSettingsPreview!: AppEditorAppSettingsPreview;

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

  getAppEditorGeneralInfoPreview(): AppEditorGeneralInfoPreview {
    if (!this.appEditorGeneralInfoPreview) {
      this.appEditorGeneralInfoPreview = new AppEditorGeneralInfoPreview(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorGeneralInfoPreview;
  }

  getAppEditorAppSettingsPreview(): AppEditorAppSettingsPreview {
    if (!this.appEditorAppSettingsPreview) {
      this.appEditorAppSettingsPreview = new AppEditorAppSettingsPreview(
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
