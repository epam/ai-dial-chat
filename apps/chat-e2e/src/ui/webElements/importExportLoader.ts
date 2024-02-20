import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ImportExportLoader extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.importExportLoader, parentLocator);
  }
}
