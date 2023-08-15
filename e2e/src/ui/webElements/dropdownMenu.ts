import { Attributes, Tags } from '@/e2e/src/ui/domData';
import { ChatBarSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class DropdownMenu extends BaseElement {
  constructor(page: Page) {
    super(page, ChatBarSelectors.dropdownMenu);
  }

  public menuOptions = () =>
    this.getChildElementBySelector(
      `${Tags.button}:not([class*=' md:${Attributes.hidden}'])`,
    );

  public menuOption = (option: string) =>
    this.menuOptions().getElementLocatorByText(option);

  public async selectMenuOption(option: string) {
    await this.menuOption(option).click();
  }

  public async getAllMenuOptions() {
    return this.menuOptions().getElementsInnerContent();
  }
}
