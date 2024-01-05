import { SideBarSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { DropdownCheckboxMenu } from '@/e2e/src/ui/webElements/dropdownCheckboxMenu';
import { Locator, Page } from '@playwright/test';

export class Filter extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, '', parentLocator);
  }

  private filterDropdownMenu!: DropdownCheckboxMenu;

  getFilterDropdownMenu(): DropdownCheckboxMenu {
    if (!this.filterDropdownMenu) {
      this.filterDropdownMenu = new DropdownCheckboxMenu(this.page);
    }
    return this.filterDropdownMenu;
  }

  private filterMenuTrigger = this.getChildElementBySelector(
    SideBarSelectors.filterMenuTrigger,
  );

  public async openFilterDropdownMenu() {
    await this.filterMenuTrigger.click();
    await this.getFilterDropdownMenu().waitForState();
  }
}
