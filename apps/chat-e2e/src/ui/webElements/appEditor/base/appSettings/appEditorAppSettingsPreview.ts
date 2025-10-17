import { AppEditorAppSettingsPreviewSelectors } from '@/src/ui/selectors';
import {
  AppEditorAppSettingsPreviewBody,
  AppEditorAppSettingsPreviewHeader,
  BaseElement,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export abstract class AppEditorAppSettingsPreview<
  B extends AppEditorAppSettingsPreviewBody,
> extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AppEditorAppSettingsPreviewSelectors.container, parentLocator);
  }

  private appEditorAppSettingsPreviewHeader!: AppEditorAppSettingsPreviewHeader;
  protected abstract appEditorAppSettingsPreviewBody: B;

  getAppEditorAppSettingsPreviewHeader(): AppEditorAppSettingsPreviewHeader {
    if (!this.appEditorAppSettingsPreviewHeader) {
      this.appEditorAppSettingsPreviewHeader =
        new AppEditorAppSettingsPreviewHeader(this.page, this.rootLocator);
    }
    return this.appEditorAppSettingsPreviewHeader;
  }

  abstract getAppEditorAppSettingsPreviewBody(): B;
}
