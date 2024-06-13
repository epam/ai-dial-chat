import { MenuSelectors } from '@/src/ui/selectors/menuSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export abstract class Menu extends BaseElement {
  constructor(page: Page) {
    super(page, MenuSelectors.dropdownMenu);
  }

  abstract menuOptions(): BaseElement;
  abstract menuOption(option: string): Locator;

  public async selectMenuOption(option: string) {
    await this.menuOption(option).click();
  }

  public async getAllMenuOptions() {
    return this.menuOptions().getElementsInnerContent();
  }
}
