import {
  BaseAppEditorAppSettingsPreview,
  CustomAppEditorAppSettingsPreviewBody,
} from '@/src/ui/webElements';

export class CustomAppEditorAppSettingsPreview extends BaseAppEditorAppSettingsPreview<CustomAppEditorAppSettingsPreviewBody> {
  protected appEditorAppSettingsPreviewBody!: CustomAppEditorAppSettingsPreviewBody;

  getAppEditorAppSettingsPreviewBody(): CustomAppEditorAppSettingsPreviewBody {
    if (!this.appEditorAppSettingsPreviewBody) {
      this.appEditorAppSettingsPreviewBody =
        new CustomAppEditorAppSettingsPreviewBody(this.page, this.rootLocator);
    }
    return this.appEditorAppSettingsPreviewBody;
  }
}
