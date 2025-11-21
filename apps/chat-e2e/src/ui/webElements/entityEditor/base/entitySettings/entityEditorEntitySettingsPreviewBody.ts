import {
  ChatSelectors,
  EntityEditorEntitySettingsPreviewSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class EntityEditorEntitySettingsPreviewBody extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, EntityEditorEntitySettingsPreviewSelectors.body, parentLocator);
  }

  public previewSpinner = this.getChildElementBySelector(ChatSelectors.spinner);
}
