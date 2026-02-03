import {
  EntityEditorEntitySettingsCardPreviewBody,
  EntityEditorEntitySettingsPreview,
} from '@/src/ui/webElements';

export class EntityEditorEntitySettingsCardPreview extends EntityEditorEntitySettingsPreview<EntityEditorEntitySettingsCardPreviewBody> {
  protected entityEditorEntitySettingsPreviewBody!: EntityEditorEntitySettingsCardPreviewBody;

  getEntityEditorEntitySettingsPreviewBody(): EntityEditorEntitySettingsCardPreviewBody {
    if (!this.entityEditorEntitySettingsPreviewBody) {
      this.entityEditorEntitySettingsPreviewBody =
        new EntityEditorEntitySettingsCardPreviewBody(
          this.page,
          this.rootLocator,
        );
    }
    return this.entityEditorEntitySettingsPreviewBody;
  }
}
