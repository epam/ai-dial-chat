import { AppEditorPreviewToggleSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorPreviewToggle extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, AppEditorPreviewToggleSelectors.toggleContainer, parentLocator);
  }

  public detailedSwitch = this.getChildElementBySelector(
    AppEditorPreviewToggleSelectors.detailedSwitch,
  ).getNthElement(1);
}
