import {
  MarketplaceSelectors,
  MarketplaceSideBarSelectors,
} from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class MarketplaceHeader extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MarketplaceSelectors.header, parentLocator);
  }

  public searchInput = this.getChildElementBySelector(
    MarketplaceSideBarSelectors.searchInput,
  );
}
