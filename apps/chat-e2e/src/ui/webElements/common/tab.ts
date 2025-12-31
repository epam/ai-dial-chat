import { TabSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class Tab extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, TabSelectors.tabContainer, parentLocator);
  }

  public tabByName = (tabLabel: string) =>
    this.getElementLocatorByText(tabLabel);
}
