import {
  CustomAppEditorAppSettingsPreview,
  EntityEditorContainer,
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorGeneralForm,
  EntityEditorGeneralInfoPreview,
  EntityEditorHeader,
  QuickApp2EditorViewForm,
} from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class QuickApp2EditorContainer extends EntityEditorContainer<
  QuickApp2EditorViewForm,
  EntityEditorEntitySettingsPreviewBody,
  CustomAppEditorAppSettingsPreview
> {
  protected entityEditorViewForm!: QuickApp2EditorViewForm;
  protected entityEditorEntitySettingsPreview!: CustomAppEditorAppSettingsPreview;

  constructor(
    page: Page,
    header: EntityEditorHeader,
    generalForm: EntityEditorGeneralForm,
    generalInfoPreview: EntityEditorGeneralInfoPreview,
  ) {
    super(page, header, generalForm, generalInfoPreview);
  }

  getEntityEditorViewForm(): QuickApp2EditorViewForm {
    if (!this.entityEditorViewForm) {
      this.entityEditorViewForm = new QuickApp2EditorViewForm(
        this.page,
        this.rootLocator,
      );
    }
    return this.entityEditorViewForm;
  }

  getEntityEditorEntitySettingsPreview(): CustomAppEditorAppSettingsPreview {
    if (!this.entityEditorEntitySettingsPreview) {
      this.entityEditorEntitySettingsPreview =
        new CustomAppEditorAppSettingsPreview(this.page, this.rootLocator);
    }
    return this.entityEditorEntitySettingsPreview;
  }
}
