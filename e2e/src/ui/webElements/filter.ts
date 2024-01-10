import { SideBarSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { DropdownCheckboxMenu } from '@/e2e/src/ui/webElements/dropdownCheckboxMenu';
import { Tooltip } from '@/e2e/src/ui/webElements/tooltip';
import { Locator, Page } from '@playwright/test';

export class Filter extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, '', parentLocator);
  }

  private filterDropdownMenu!: DropdownCheckboxMenu;
  private tooltip!: Tooltip;

  getFilterDropdownMenu(): DropdownCheckboxMenu {
    if (!this.filterDropdownMenu) {
      this.filterDropdownMenu = new DropdownCheckboxMenu(this.page);
    }
    return this.filterDropdownMenu;
  }

  getTooltip(): Tooltip {
    if (!this.tooltip) {
      this.tooltip = new Tooltip(this.page);
    }
    return this.tooltip;
  }

  private filterMenuTrigger = this.getChildElementBySelector(
    SideBarSelectors.filterMenuTrigger,
  );

  public async openFilterDropdownMenu() {
    await this.filterMenuTrigger.hoverOver();
    await this.getTooltip().waitForState();
    await this.filterMenuTrigger.click();
    await this.getFilterDropdownMenu().waitForState();
  }
}
