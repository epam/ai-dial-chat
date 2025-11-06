import {
  AppEditorAppSettingsPreviewBody,
  AppEditorContainer,
  AppEditorGeneralForm,
  AppEditorGeneralInfoAgentPreview,
  AppEditorHeader,
  ExternalAppEditorAppSettingsPreview,
  ExternalAppEditorViewForm,
} from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class ExternalAppEditorContainer extends AppEditorContainer<
  ExternalAppEditorViewForm,
  AppEditorAppSettingsPreviewBody,
  ExternalAppEditorAppSettingsPreview
> {
  protected appEditorViewForm!: ExternalAppEditorViewForm;
  protected appEditorAppSettingsPreview!: ExternalAppEditorAppSettingsPreview;

  constructor(
    page: Page,
    header: AppEditorHeader,
    generalForm: AppEditorGeneralForm,
    generalInfoPreview: AppEditorGeneralInfoAgentPreview,
  ) {
    super(page, header, generalForm, generalInfoPreview);
  }

  getAppEditorViewForm(): ExternalAppEditorViewForm {
    if (!this.appEditorViewForm) {
      this.appEditorViewForm = new ExternalAppEditorViewForm(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorViewForm;
  }

  getAppEditorAppSettingsPreview() {
    if (!this.appEditorAppSettingsPreview) {
      this.appEditorAppSettingsPreview =
        new ExternalAppEditorAppSettingsPreview(this.page, this.rootLocator);
    }
    return this.appEditorAppSettingsPreview;
  }
}
