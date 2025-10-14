import { ChatSelectors } from '@/src/ui/selectors';
import {
  AppEditorGeneralForm,
  AppEditorGeneralInfoAgentPreview,
  BaseAppEditorAppSettingsPreview,
  BaseAppEditorAppSettingsPreviewBody,
  BaseAppEditorHeader,
  BaseAppEditorViewForm,
  BaseElement,
} from '@/src/ui/webElements';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';
import { Page } from '@playwright/test';

export abstract class BaseAppEditorContainer<
  E extends BaseAppEditorViewForm,
  B extends BaseAppEditorAppSettingsPreviewBody,
  P extends BaseAppEditorAppSettingsPreview<B>,
> extends BaseLayoutContainer<BaseAppEditorHeader> {
  //common General form
  private readonly appEditorGeneralForm!: AppEditorGeneralForm;
  //common General Preview
  private readonly appEditorGeneralInfoPreview!: AppEditorGeneralInfoAgentPreview;
  //abstract App Editor View form
  protected abstract appEditorViewForm: E;
  //abstract App Editor Preview
  protected abstract appEditorAppSettingsPreview: P;

  protected constructor(
    page: Page,
    header: BaseAppEditorHeader,
    generalForm: AppEditorGeneralForm,
    generalInfoPreview: AppEditorGeneralInfoAgentPreview,
  ) {
    super(page);
    this.header = header;
    this.appEditorGeneralForm = generalForm;
    this.appEditorGeneralInfoPreview = generalInfoPreview;
  }

  //common top header
  getHeader(): BaseAppEditorHeader {
    return this.header;
  }

  getAppEditorGeneralForm(): AppEditorGeneralForm {
    return this.appEditorGeneralForm;
  }

  getAppEditorGeneralInfoPreview(): AppEditorGeneralInfoAgentPreview {
    return this.appEditorGeneralInfoPreview;
  }

  abstract getAppEditorViewForm(): E;

  abstract getAppEditorAppSettingsPreview(): P;

  getChatLoader(): BaseElement {
    return this.getChildElementBySelector(ChatSelectors.entitySpinner);
  }
}
