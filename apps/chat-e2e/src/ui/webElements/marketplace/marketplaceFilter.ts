import { Tags } from '@/src/ui/domData';
import { MarketplaceSideBarSelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class MarketplaceFilter extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MarketplaceSideBarSelectors.marketplaceFilter, parentLocator);
  }

  public filterByProperty = (property: string) => {
    return this.getChildElementBySelector(
      MarketplaceSideBarSelectors.filterProperty,
    ).getElementLocatorByText(property);
  };

  public filterByPropertyOptions = (property: string) => {
    return this.filterByProperty(property).locator(
      `~${MarketplaceSideBarSelectors.filterPropertyOptions}`,
    );
  };

  public filterByPropertyOptionInput = (property: string, option: string) => {
    return this.filterByPropertyOptions(property)
      .locator(MarketplaceSideBarSelectors.filterPropertyOption)
      .filter({ hasText: option })
      .locator(Tags.input);
  };

  public async checkTypeFilterOption(option: string) {
    await this.filterByPropertyOptionInput('Type', option).click();
  }
}
