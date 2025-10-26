import {
  AppEditorAppSettingsPreview,
  ExternalAppEditorAppSettingsPreviewBody,
} from '@/src/ui/webElements';

export class ExternalAppEditorAppSettingsPreview extends AppEditorAppSettingsPreview<ExternalAppEditorAppSettingsPreviewBody> {
  protected appEditorAppSettingsPreviewBody!: ExternalAppEditorAppSettingsPreviewBody;

  getAppEditorAppSettingsPreviewBody(): ExternalAppEditorAppSettingsPreviewBody {
    if (!this.appEditorAppSettingsPreviewBody) {
      this.appEditorAppSettingsPreviewBody =
        new ExternalAppEditorAppSettingsPreviewBody(
          this.page,
          this.rootLocator,
        );
    }
    return this.appEditorAppSettingsPreviewBody;
  }
}
