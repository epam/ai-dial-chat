import { API } from '@/src/testData';
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
      this.accountSettings = new AccountSettings(this.page);
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

  public backToChatButton = this.getChildElementBySelector(
    HeaderSelectors.backToChatButton,
  );

  public async createNewConversation() {
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    await this.newEntityButton.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
  }
}
