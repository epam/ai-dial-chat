import { MarketplaceEntityDetailsModalSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class MarketplaceEntityDetailsModal extends BaseElement {
  constructor(page: Page) {
    super(page, MarketplaceEntityDetailsModalSelector.container);
  }

  public version = this.getChildElementBySelector(
    MarketplaceEntityDetailsModalSelector.version,
  );

  public entityName = this.getChildElementBySelector(
    MarketplaceEntityDetailsModalSelector.entityName,
  );

  public loginButton = this.getChildElementBySelector(
    MarketplaceEntityDetailsModalSelector.loginButton,
  );
}
