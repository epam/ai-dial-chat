import {
  AppEditorAppSettingsPreviewSelectors,
  IconSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorAppSettingsPreviewHeader extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AppEditorAppSettingsPreviewSelectors.header, parentLocator);
  }

  protected expandIcon = this.getChildElementBySelector(
    IconSelectors.arrowsMaximizeIcon,
  );
  protected hideIcon = this.getChildElementBySelector(
    IconSelectors.arrowsMinimizeIcon,
  );
}
