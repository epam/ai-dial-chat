import { CustomAppEditorAppSettingsPreviewBody } from '@/src/ui/webElements';
import { EntityEditorEntitySettingsPreview } from '@/src/ui/webElements';

export class CustomAppEditorAppSettingsPreview extends EntityEditorEntitySettingsPreview<CustomAppEditorAppSettingsPreviewBody> {
  protected entityEditorEntitySettingsPreviewBody!: CustomAppEditorAppSettingsPreviewBody;

  getEntityEditorEntitySettingsPreviewBody(): CustomAppEditorAppSettingsPreviewBody {
    if (!this.entityEditorEntitySettingsPreviewBody) {
      this.entityEditorEntitySettingsPreviewBody =
        new CustomAppEditorAppSettingsPreviewBody(this.page, this.rootLocator);
    }
    return this.entityEditorEntitySettingsPreviewBody;
  }
}
