import { MarketplaceFilterTypes } from '@/src/testData';
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

  public filterByPropertyChevronIcon = (property: string) => {
    return this.filterByProperty(property).locator(Tags.svg);
  };

  public filterByPropertyOptions = (property: string) => {
    return this.filterByProperty(property).locator(
      `~${MarketplaceSideBarSelectors.filterPropertyOptions}`,
    );
  };

  public filterByPropertyOption = (property: string, option: string) => {
    return this.filterByPropertyOptions(property)
      .locator(MarketplaceSideBarSelectors.filterPropertyOption)
      .filter({ hasText: option });
  };

  public filterByPropertyOptionInput = (property: string, option: string) => {
    return this.filterByPropertyOption(property, option).locator(Tags.input);
  };

  public filterByPropertyOptionLabel = (property: string, option: string) => {
    return this.filterByPropertyOption(property, option).locator(
      MarketplaceSideBarSelectors.optionLabel,
    );
  };

  public async filterByPropertyOptionLabels(property: string) {
    return this.filterByPropertyOptions(property)
      .locator(MarketplaceSideBarSelectors.optionLabel)
      .allInnerTexts();
  }

  public async checkTypeFilterOption(option: string) {
    await this.filterByPropertyOptionInput(
      MarketplaceFilterTypes.type,
      option,
    ).click();
  }
}
