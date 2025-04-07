import { ChatSelectors } from '@/src/ui/selectors';
import { AppEditorGeneralForm, BaseElement } from '@/src/ui/webElements';
import { AppEditorChatMode } from '@/src/ui/webElements/appEditor/appEditorChatMode';
import { AppEditorHeader } from '@/src/ui/webElements/appEditor/appEditorHeader';
import { AppEditorPreview } from '@/src/ui/webElements/appEditor/appEditorPreview';
import { AppEditorViewForm } from '@/src/ui/webElements/appEditor/appEditorViewForm';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';

export class AppEditorContainer extends BaseLayoutContainer<AppEditorHeader> {
  private appEditorHeader!: AppEditorHeader;
  private appEditorGeneralForm!: AppEditorGeneralForm;
  private appEditorViewForm!: AppEditorViewForm;
  private appEditorPreview!: AppEditorPreview;
  private appEditorChatMode!: AppEditorChatMode;

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

  getAppEditorPreview(): AppEditorPreview {
    if (!this.appEditorPreview) {
      this.appEditorPreview = new AppEditorPreview(this.page, this.rootLocator);
    }
    return this.appEditorPreview;
  }

  getAppEditorChatMode(): AppEditorChatMode {
    if (!this.appEditorChatMode) {
      this.appEditorChatMode = new AppEditorChatMode(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorChatMode;
  }

  getChatLoader(): BaseElement {
    return this.getChildElementBySelector(ChatSelectors.messageSpinner);
  }
}
