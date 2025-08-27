import { MenuSelectors } from '@/src/ui/selectors/menuSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';
import { Response } from 'playwright-core';

export abstract class Menu extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, MenuSelectors.dropdownMenu, parentLocator);
  }

  abstract menuOptions(): BaseElement;
  abstract menuOption(option: string): Locator;

  public async selectMenuOption(option: string): Promise<void | Response> {
    await this.menuOption(option).click();
  }

  public async getAllMenuOptions() {
    return this.menuOptions().getElementsInnerContent();
  }
}
