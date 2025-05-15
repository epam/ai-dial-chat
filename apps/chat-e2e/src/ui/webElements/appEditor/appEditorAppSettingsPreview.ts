import { AppEditorAppSettingsPreviewSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { AppEditorChatMode } from '@/src/ui/webElements/appEditor/appEditorChatMode';
import { Locator, Page } from '@playwright/test';

export class AppEditorAppSettingsPreview extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AppEditorAppSettingsPreviewSelectors.container, parentLocator);
  }

  private appEditorChatMode!: AppEditorChatMode;

  public getAppEditorChatMode() {
    if (!this.appEditorChatMode) {
      this.appEditorChatMode = new AppEditorChatMode(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorChatMode;
  }
}
