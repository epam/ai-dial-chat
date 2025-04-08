import { NavigationPanelSelectors } from '@/src/ui/selectors';
import { AccountSettings } from '@/src/ui/webElements/accountSettings';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class NavigationPanel extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, NavigationPanelSelectors.container, parentLocator);
  }

  private accountSettings!: AccountSettings;

  public backToChatButton = this.getChildElementBySelector(
    NavigationPanelSelectors.backToChatButton,
  );
  public marketplaceHomeButton = this.getChildElementBySelector(
    NavigationPanelSelectors.marketplaceHomeButton,
  );
  public myWorkspaceButton = this.getChildElementBySelector(
    NavigationPanelSelectors.myWorkspaceButton,
  );

  public getAccountSettings() {
    if (!this.accountSettings) {
      this.accountSettings = new AccountSettings(this.page, this.rootLocator);
    }
    return this.accountSettings;
  }
}
