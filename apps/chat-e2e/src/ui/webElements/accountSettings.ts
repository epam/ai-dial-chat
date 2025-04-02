import { AccountMenuOptions, AuthProvider } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { HeaderSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { ConfirmationDialog } from '@/src/ui/webElements/confirmationDialog';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { Locator, Page } from '@playwright/test';
import process from 'node:process';

export class AccountSettings extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, HeaderSelectors.accountSettings, parentLocator);
  }

  private dropdownMenu!: DropdownMenu;
  private confirmationDialog!: ConfirmationDialog;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  getConfirmationDialog(): ConfirmationDialog {
    if (!this.confirmationDialog) {
      this.confirmationDialog = new ConfirmationDialog(this.page);
    }
    return this.confirmationDialog;
  }

  public accountSettingsCaret = this.getChildElementBySelector(
    `.${Attributes.rotated180}`,
  );

  public avatarIcon = this.getChildElementBySelector(HeaderSelectors.avatar);

  public async openAccountDropdownMenu() {
    await this.click();
    await this.getDropdownMenu().waitForState();
  }

  public async logout() {
    await this.openAccountDropdownMenu();
    await this.getDropdownMenu().selectMenuOption(AccountMenuOptions.logout);
    if (
      process.env.AUTH_PROVIDER === AuthProvider.auth0 ||
      process.env.AUTH_PROVIDER === undefined
    ) {
      const respPromise = this.page.waitForResponse(
        (r) => r.url().includes('/challenge') && r.status() === 200,
      );
      await this.getConfirmationDialog().confirm();
      await respPromise;
    }
  }
}
