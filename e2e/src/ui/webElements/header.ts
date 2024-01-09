import { HeaderSelectors } from '@/e2e/src/ui/selectors';
import { AccountSettings } from '@/e2e/src/ui/webElements/accountSettings';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Header extends BaseElement {
  constructor(page: Page) {
    super(page, HeaderSelectors.headerContainer);
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
