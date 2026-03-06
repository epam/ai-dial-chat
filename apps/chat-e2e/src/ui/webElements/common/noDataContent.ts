import { NoDataContentSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class NoDataContent extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, NoDataContentSelectors.noDataContainer, parentLocator);
  }

  public noResultsTitle = this.getChildElementBySelector(
    NoDataContentSelectors.noResultsTitle,
  );
  public noResultsReason = this.getChildElementBySelector(
    NoDataContentSelectors.noResultsReason,
  );
}
