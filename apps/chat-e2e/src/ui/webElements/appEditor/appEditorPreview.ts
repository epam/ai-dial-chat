import { ApplicationPreviewSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorPreview extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ApplicationPreviewSelector.container, parentLocator);
  }
}
