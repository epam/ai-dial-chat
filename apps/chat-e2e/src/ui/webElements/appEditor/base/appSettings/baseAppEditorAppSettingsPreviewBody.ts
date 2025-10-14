import { AppEditorAppSettingsPreviewSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class BaseAppEditorAppSettingsPreviewBody extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AppEditorAppSettingsPreviewSelectors.body, parentLocator);
  }
}
