import { DropdownSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Page } from '@playwright/test';
import { Response } from 'playwright-core';

export class Dropdown extends BaseElement {
  constructor(page: Page) {
    super(page, DropdownSelectors.dropdownContainer);
  }

  public dropdownItems = this.getChildElementBySelector(
    DropdownSelectors.dropdownItem,
  );
  public dropdownItemByName = (name: string) =>
    this.dropdownItems.getElementLocatorByText(name);

  public dropdownItemText = (name: string) =>
    this.dropdownItemByName(name).locator(DropdownSelectors.dropdownItemText);

  public async selectItem(
    item: string,
    {
      isHttpMethodTriggered = true,
      triggeredHttpMethod = undefined,
      apiHost = undefined,
    }: {
      isHttpMethodTriggered?: boolean;
      triggeredHttpMethod?: 'PUT' | 'POST' | 'DELETE' | 'GET';
      apiHost?: string;
    } = {},
  ) {
    if (isHttpMethodTriggered && triggeredHttpMethod) {
      const predicate = (resp: Response) =>
        apiHost !== undefined
          ? resp.request().method() === triggeredHttpMethod &&
            resp.status() === 200 &&
            resp.url().includes(apiHost)
          : resp.request().method() === triggeredHttpMethod &&
            resp.status() === 200;
      const respPromise = this.page.waitForResponse(predicate);
      await this.dropdownItemByName(item).click();
      return respPromise;
    }
    await this.dropdownItemByName(item).click();
  }
}
