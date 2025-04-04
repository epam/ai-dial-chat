import config from '@/config/chat.playwright.config';
import { API } from '@/src/testData';
import { NavigationPanelSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class NavigationPanel extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, NavigationPanelSelectors.container, parentLocator);
  }

  public backToChatButton = this.getChildElementBySelector(
    NavigationPanelSelectors.backToChatButton,
  );
  public marketplaceHomeButton = this.getChildElementBySelector(
    NavigationPanelSelectors.marketplaceHomeButton,
  );
  public myWorkspaceButton = this.getChildElementBySelector(
    NavigationPanelSelectors.myWorkspaceButton,
  );

  public async goToMarketplaceFromDialHome() {
    await this.goToMarketplacePage(() => this.marketplaceHomeButton.click());
  }

  public async goToMyWorkspaceFromDialHome() {
    await this.goToMarketplacePage(() => this.myWorkspaceButton.click());
  }

  public async backToChat() {
    const responsePromise = this.page.waitForResponse((resp) =>
      resp.url().includes(API.pagePropsHost),
    );
    await this.backToChatButton.click();
    await responsePromise;
  }

  private async goToMarketplacePage(method: () => Promise<void>) {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(API.marketplaceHost),
      { timeout: config.use!.actionTimeout! * 3 },
    );
    await method();
    await responsePromise;
  }
}
