import { ElementState, ExpectedMessages } from '@/src/testData';
import { Menu } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class MenuAssertion {
  readonly menu: Menu;

  constructor(menu: Menu) {
    this.menu = menu;
  }

  public async assertMenuOptions(expectedOptions: string[]) {
    const menuOptions = await this.menu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual(expectedOptions);
  }

  public async assertMenuIncludesOptions(expectedOptions: string[]) {
    const menuOptions = await this.menu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual(expect.arrayContaining(expectedOptions));
  }

  public async assertMenuState(expectedState: ElementState) {
    const menu = this.menu.getElementLocator();
    expectedState === 'visible'
      ? await expect.soft(menu, ExpectedMessages.menuIsVisible).toBeVisible()
      : await expect.soft(menu, ExpectedMessages.menuIsNotVisible).toBeHidden();
  }
}
