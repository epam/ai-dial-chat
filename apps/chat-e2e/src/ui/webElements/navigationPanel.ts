import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
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
  public backToChatButtonIcon = this.getChildElementBySelector(
    NavigationPanelSelectors.backToChatButton,
  ).getChildElementBySelector(Tags.svg);
  public marketplaceHomeButton = this.getChildElementBySelector(
    NavigationPanelSelectors.marketplaceHomeButton,
  );
  public marketplaceHomeButtonIcon = this.getChildElementBySelector(
    NavigationPanelSelectors.marketplaceHomeButton,
  ).getChildElementBySelector(Tags.svg);
  public myWorkspaceButton = this.getChildElementBySelector(
    NavigationPanelSelectors.myWorkspaceButton,
  );
  public myWorkspaceButtonIcon = this.getChildElementBySelector(
    NavigationPanelSelectors.myWorkspaceButton,
  ).getChildElementBySelector(Tags.svg);
  public filesButton = new Button(this.page, 'Files', this.rootLocator);
  public buttonLabel = (button: BaseElement) =>
    button.getChildElementBySelector(NavigationPanelSelectors.buttonLabel);

  public async goToMarketplaceHome() {
    await this.marketplaceHomeButton.click();
  }

  public async goToMyWorkspace() {
    await this.myWorkspaceButton.click();
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

  public async goToFileManager(
    options: { isFilesListingTriggered?: boolean } = {
      isFilesListingTriggered: true,
    },
  ) {
    const hostsArray = options?.isFilesListingTriggered
      ? [API.filePropsHost, API.filesListingHost()]
      : [API.filePropsHost];
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
    await this.filesButton.click();
    for (const resp of responses) {
      await resp;
    }
  }
}
