import {
  AppEditorAppSettingsPreviewSelectors,
  ChatSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorAppSettingsPreviewBody extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AppEditorAppSettingsPreviewSelectors.body, parentLocator);
  }

  public previewSpinner = this.getChildElementBySelector(ChatSelectors.spinner);
}
