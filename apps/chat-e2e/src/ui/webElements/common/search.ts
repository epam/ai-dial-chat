import { Input } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class Search extends Input {
  constructor(page: Page, parentLocator: Locator) {
    super(page, parentLocator);
  }
}
