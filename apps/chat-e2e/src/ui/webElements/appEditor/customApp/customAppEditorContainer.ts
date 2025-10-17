import {
  AppEditorAppSettingsPreviewBody,
  AppEditorContainer,
  AppEditorGeneralForm,
  AppEditorGeneralInfoAgentPreview,
  AppEditorHeader,
  CustomAppEditorAppSettingsPreview,
  CustomAppEditorViewForm,
} from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class CustomAppEditorContainer extends AppEditorContainer<
  CustomAppEditorViewForm,
  AppEditorAppSettingsPreviewBody,
  CustomAppEditorAppSettingsPreview
> {
  protected appEditorViewForm!: CustomAppEditorViewForm;
  protected appEditorAppSettingsPreview!: CustomAppEditorAppSettingsPreview;

  constructor(
    page: Page,
    header: AppEditorHeader,
    generalForm: AppEditorGeneralForm,
    generalInfoPreview: AppEditorGeneralInfoAgentPreview,
  ) {
    super(page, header, generalForm, generalInfoPreview);
  }

  getAppEditorViewForm(): CustomAppEditorViewForm {
    if (!this.appEditorViewForm) {
      this.appEditorViewForm = new CustomAppEditorViewForm(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorViewForm;
  }

  getAppEditorAppSettingsPreview() {
    if (!this.appEditorAppSettingsPreview) {
      this.appEditorAppSettingsPreview = new CustomAppEditorAppSettingsPreview(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorAppSettingsPreview;
  }
}
