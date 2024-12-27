import { OverlayBasePage } from '@/src/ui/pages/overlay/overlayBasePage';
import { MarketplaceContainer } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class OverlayMarketplacePage extends OverlayBasePage<MarketplaceContainer> {
  constructor(page: Page) {
    super(page, new MarketplaceContainer(page));
  }

  getMarketplaceContainer() {
    return this.getOverlayContainer();
  }

  async waitForPageLoaded() {
    await this.getMarketplaceContainer()
      .getChatLoader()
      .waitForState({ state: 'hidden' });
  }
}
