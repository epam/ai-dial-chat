import { API } from '@/src/testData';
import { NavigationPanelSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Button } from '@/src/ui/webElements/common/button';
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
  public filesButton = new Button(this.page, 'Files', this.rootLocator);
  public buttonLabel = (button: BaseElement) =>
    button.getChildElementBySelector(NavigationPanelSelectors.buttonLabel);

  public async goToMarketplaceHome() {
    // eslint-disable-next-line playwright/no-force-option
    await this.marketplaceHomeButton.click({ force: true });
  }

  public async goToMyWorkspace() {
    // eslint-disable-next-line playwright/no-force-option
    await this.myWorkspaceButton.click({ force: true });
  }

  public async backToChat(
    options: { isHttpMethodTriggered?: boolean } = {
      isHttpMethodTriggered: true,
    },
  ) {
    if (options.isHttpMethodTriggered) {
      const responsePromise = this.page.waitForResponse((resp) =>
        resp.url().includes(API.pagePropsHost),
      );
      await this.backToChatButton.click();
      await responsePromise;
    } else {
      await this.backToChatButton.click();
    }
  }

  public async goToFilesManager() {
    const hostsArray = [API.filePropsHost, API.filesListingHost()];
    const responses = [];
    for (const host of hostsArray) {
      const resp = this.page.waitForResponse(
        (response) =>
          response.url().includes(host) &&
          response.request().method() === 'GET' &&
          response.status() === 200,
      );
      responses.push(resp);
    }
    // eslint-disable-next-line playwright/no-force-option
    await this.filesButton.click({ force: true });
    for (const resp of responses) {
      await resp;
    }
  }
}
