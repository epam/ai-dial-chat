import {
  AppEditorAppSettingsPreviewBody,
  AppEditorPreviewCard,
  AppEditorPreviewToggle,
} from '@/src/ui/webElements';

export class ExternalAppEditorAppSettingsPreviewBody extends AppEditorAppSettingsPreviewBody {
  private appEditorPreviewToggle!: AppEditorPreviewToggle;
  private appEditorPreviewCard!: AppEditorPreviewCard;

  public getAppEditorPreviewToggle() {
    if (!this.appEditorPreviewToggle) {
      this.appEditorPreviewToggle = new AppEditorPreviewToggle(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorPreviewToggle;
  }

  public getAppEditorPreviewCard() {
    if (!this.appEditorPreviewCard) {
      this.appEditorPreviewCard = new AppEditorPreviewCard(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorPreviewCard;
  }
}
