import { Attributes } from '@/src/ui/domData';
import { HeaderSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { Locator, Page } from '@playwright/test';

export class AccountSettings extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, HeaderSelectors.accountSettings, parentLocator);
  }

  private dropdownMenu!: DropdownMenu;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  public accountSettingsCaret = this.getChildElementBySelector(
    `.${Attributes.rotated180}`,
  );

  public avatarIcon = this.getChildElementBySelector(HeaderSelectors.avatar);

  public closeButton = this.getChildElementBySelector(
    HeaderSelectors.closeButton,
  );

  public async openAccountDropdownMenu() {
    await this.click();
    await this.getDropdownMenu().waitForState();
  }
}
