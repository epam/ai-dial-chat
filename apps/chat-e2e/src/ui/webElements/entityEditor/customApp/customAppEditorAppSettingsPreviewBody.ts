import {
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorEntitySettingsPreviewChat,
} from '@/src/ui/webElements';

export class CustomAppEditorAppSettingsPreviewBody extends EntityEditorEntitySettingsPreviewBody {
  private appEditorAppSettingsPreviewChat!: EntityEditorEntitySettingsPreviewChat;

  public getAppEditorAppSettingsPreviewChat() {
    if (!this.appEditorAppSettingsPreviewChat) {
      this.appEditorAppSettingsPreviewChat =
        new EntityEditorEntitySettingsPreviewChat(this.page, this.rootLocator);
    }
    return this.appEditorAppSettingsPreviewChat;
  }
}
