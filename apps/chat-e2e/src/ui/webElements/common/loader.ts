import { LoaderSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class Loader extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, LoaderSelectors.loaderContainer, parentLocator);
  }
}
