import { HeaderSelectors } from '@/src/ui/selectors';
import { AccountSettings } from '@/src/ui/webElements/accountSettings';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class Header extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, HeaderSelectors.headerContainer, parentLocator);
  }

  private accountSettings!: AccountSettings;

  public getAccountSettings() {
    if (!this.accountSettings) {
      this.accountSettings = new AccountSettings(this.page, this.rootLocator);
    }
    return this.accountSettings;
  }

  public leftPanelToggle = this.getChildElementBySelector(
    HeaderSelectors.leftPanelToggle,
  );
  public rightPanelToggle = this.getChildElementBySelector(
    HeaderSelectors.rightPanelToggle,
  );

  public newEntityButton = this.getChildElementBySelector(
    HeaderSelectors.newEntity,
  );

  public logo = this.getChildElementBySelector(HeaderSelectors.logo);

  public async createNewConversation(options?: { triggeredHttpHost?: string }) {
    if (options?.triggeredHttpHost) {
      const respPromise = this.page.waitForResponse(
        (r) =>
          r.url().includes(options.triggeredHttpHost!) && r.status() === 200,
      );
      await this.newEntityButton.click();
      await respPromise;
    } else {
      await this.newEntityButton.click();
    }
  }
}
