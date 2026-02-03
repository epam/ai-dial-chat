import {
  CustomAppEditorAppSettingsPreview,
  CustomAppEditorViewForm,
} from '@/src/ui/webElements';
import {
  EntityEditorContainer,
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorGeneralForm,
  EntityEditorGeneralInfoPreview,
  EntityEditorHeader,
} from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class CustomAppEditorContainer extends EntityEditorContainer<
  CustomAppEditorViewForm,
  EntityEditorEntitySettingsPreviewBody,
  CustomAppEditorAppSettingsPreview
> {
  protected entityEditorViewForm!: CustomAppEditorViewForm;
  protected entityEditorEntitySettingsPreview!: CustomAppEditorAppSettingsPreview;

  constructor(
    page: Page,
    header: EntityEditorHeader,
    generalForm: EntityEditorGeneralForm,
    generalInfoPreview: EntityEditorGeneralInfoPreview,
  ) {
    super(page, header, generalForm, generalInfoPreview);
  }

  getEntityEditorViewForm(): CustomAppEditorViewForm {
    if (!this.entityEditorViewForm) {
      this.entityEditorViewForm = new CustomAppEditorViewForm(
        this.page,
        this.rootLocator,
      );
    }
    return this.entityEditorViewForm;
  }

  getEntityEditorEntitySettingsPreview() {
    if (!this.entityEditorEntitySettingsPreview) {
      this.entityEditorEntitySettingsPreview =
        new CustomAppEditorAppSettingsPreview(this.page, this.rootLocator);
    }
    return this.entityEditorEntitySettingsPreview;
  }
}
