import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
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
}
