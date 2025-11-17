import { API } from '@/src/testData';
import { IconSelectors } from '@/src/ui/selectors';
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

  public agentsTab = this.getChildElementBySelector(
    MarketplaceSideBarSelectors.agentsTab,
  );
  public toolsetsTab = this.getChildElementBySelector(
    MarketplaceSideBarSelectors.toolsetsTab,
  );

  public searchInput = this.getChildElementBySelector(
    MarketplaceSideBarSelectors.searchInput,
  );
  public addAppButton = this.getChildElementBySelector(
    MarketplaceSelectors.addApp,
  );
  public addToolsetButton = this.getChildElementBySelector(
    MarketplaceSelectors.addToolset,
  );
  public addToolsetButtonIcon = this.addToolsetButton.getChildElementBySelector(
    IconSelectors.plusIcon,
  );

  public async clickAddToolsetButton() {
    const respPromise = this.page.waitForResponse(
      (resp) =>
        resp.request().method() === 'GET' &&
        resp.url().includes(API.toolsetEditorHost) &&
        resp.status() === 200,
    );
    await this.addToolsetButton.click();
    await respPromise;
  }
}
