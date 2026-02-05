import {
  EntityEditorContainer,
  EntityEditorEntitySettingsCardPreview,
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorGeneralForm,
  EntityEditorGeneralInfoPreview,
  EntityEditorHeader,
  ToolsetEditorViewForm,
} from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class ToolsetEditorContainer extends EntityEditorContainer<
  ToolsetEditorViewForm,
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorEntitySettingsCardPreview
> {
  protected entityEditorViewForm!: ToolsetEditorViewForm;
  protected entityEditorEntitySettingsPreview!: EntityEditorEntitySettingsCardPreview;

  constructor(
    page: Page,
    header: EntityEditorHeader,
    generalForm: EntityEditorGeneralForm,
    generalInfoPreview: EntityEditorGeneralInfoPreview,
  ) {
    super(page, header, generalForm, generalInfoPreview);
  }

  getEntityEditorViewForm(): ToolsetEditorViewForm {
    if (!this.entityEditorViewForm) {
      this.entityEditorViewForm = new ToolsetEditorViewForm(
        this.page,
        this.rootLocator,
      );
    }
    return this.entityEditorViewForm;
  }

  getEntityEditorEntitySettingsPreview() {
    if (!this.entityEditorEntitySettingsPreview) {
      this.entityEditorEntitySettingsPreview =
        new EntityEditorEntitySettingsCardPreview(this.page, this.rootLocator);
    }
    return this.entityEditorEntitySettingsPreview;
  }
}
