import { isApiStorageType } from '@/src/hooks/global-setup';
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

  public async selectMenuOption(
    option: string,
    {
      triggeredHttpMethod = undefined,
      isHttpMethodTriggered = true,
      apiHost = undefined,
    }: {
      triggeredHttpMethod?: 'PUT' | 'POST' | 'DELETE' | 'GET';
      isHttpMethodTriggered?: boolean;
      apiHost?: string;
    } = {},
  ) {
    if (isApiStorageType && isHttpMethodTriggered && triggeredHttpMethod) {
      const predicate = (resp: Response) =>
        apiHost !== undefined
          ? resp.request().method() === triggeredHttpMethod &&
            resp.status() === 200 &&
            resp.url().includes(apiHost)
          : resp.request().method() === triggeredHttpMethod &&
            resp.status() === 200;
      const respPromise = this.page.waitForResponse(predicate);
      await this.menuOption(option).click();
      return respPromise;
    }
    await this.menuOption(option).click();
  }

  public async getAllMenuOptions() {
    return this.menuOptions().getElementsInnerContent();
  }
}
