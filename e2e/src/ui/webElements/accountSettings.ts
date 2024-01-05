import { HeaderSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { Page } from '@playwright/test';

export class AccountSettings extends BaseElement {
  constructor(page: Page) {
    super(page, HeaderSelectors.accountSettings);
  }

  private dropdownMenu!: DropdownMenu;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }
  public async openAccountDropdownMenu() {
    await this.click();
    await this.getDropdownMenu().waitForState();
  }
}
