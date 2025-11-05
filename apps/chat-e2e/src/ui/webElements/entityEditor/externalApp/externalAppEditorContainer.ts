import {
  EntityEditorContainer,
  EntityEditorEntitySettingsCardPreview,
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorGeneralForm,
  EntityEditorGeneralInfoPreview,
  EntityEditorHeader,
  ExternalAppEditorViewForm,
} from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class ExternalAppEditorContainer extends EntityEditorContainer<
  ExternalAppEditorViewForm,
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorEntitySettingsCardPreview
> {
  protected entityEditorViewForm!: ExternalAppEditorViewForm;
  protected entityEditorEntitySettingsPreview!: EntityEditorEntitySettingsCardPreview;

  constructor(
    page: Page,
    header: EntityEditorHeader,
    generalForm: EntityEditorGeneralForm,
    generalInfoPreview: EntityEditorGeneralInfoPreview,
  ) {
    super(page, header, generalForm, generalInfoPreview);
  }

  getEntityEditorViewForm(): ExternalAppEditorViewForm {
    if (!this.entityEditorViewForm) {
      this.entityEditorViewForm = new ExternalAppEditorViewForm(
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
