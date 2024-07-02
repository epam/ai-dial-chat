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

  public chatPanelToggle = this.getChildElementBySelector(
    HeaderSelectors.chatPanelToggle,
  );
  public promptsPanelToggle = this.getChildElementBySelector(
    HeaderSelectors.promptsPanelToggle,
  );
}
