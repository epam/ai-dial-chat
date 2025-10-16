import {
  AppEditorAppSettingsPreviewBody,
  AppEditorAppSettingsPreviewChat,
} from '@/src/ui/webElements';

export class CustomAppEditorAppSettingsPreviewBody extends AppEditorAppSettingsPreviewBody {
  private appEditorAppSettingsPreviewChat!: AppEditorAppSettingsPreviewChat;

  public getAppEditorAppSettingsPreviewChat() {
    if (!this.appEditorAppSettingsPreviewChat) {
      this.appEditorAppSettingsPreviewChat =
        new AppEditorAppSettingsPreviewChat(this.page, this.rootLocator);
    }
    return this.appEditorAppSettingsPreviewChat;
  }
}
