import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Menu } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class MenuAssertion extends BaseAssertion {
  readonly menu: Menu;

  constructor(menu: Menu) {
    super();
    this.menu = menu;
  }

  public async assertMenuOptions(expectedOptions: string[]) {
    const menuOptions = await this.menu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual(expectedOptions);
  }

  public async assertMenuIncludesOptions(...expectedOptions: string[]) {
    const menuOptions = await this.menu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual(expect.arrayContaining(expectedOptions));
  }

  public async assertMenuExcludesOptions(...excludedOptions: string[]) {
    const menuOptions = await this.menu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionIsNotAvailable)
      .not.toEqual(expect.arrayContaining(excludedOptions));
  }

  public async assertMenuState(expectedState: ElementState) {
    const menu = this.menu.getElementLocator();
    expectedState === 'visible'
      ? await expect.soft(menu, ExpectedMessages.menuIsVisible).toBeVisible()
      : await expect.soft(menu, ExpectedMessages.menuIsNotVisible).toBeHidden();
  }

  public async assertMenuOptionActionabilityState(
    option: MenuOptions,
    state: ElementActionabilityState,
  ) {
    const optionLocator = this.menu.menuOption(option);
    await this.assertElementActionabilityState(optionLocator, state);
  }
}
