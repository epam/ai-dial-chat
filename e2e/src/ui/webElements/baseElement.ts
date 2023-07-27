import { Locator, Page } from '@playwright/test';

export class BaseElement {
  private readonly page: Page;
  private rootSelector: string;
  private rootLocator: Locator;

  constructor(page: Page, selector: string, locator?: Locator) {
    this.page = page;
    this.rootLocator = locator ?? this.page.locator(selector);
    this.rootSelector = selector;
  }

  public getRootSelector() {
    return this.rootSelector;
  }

  public getRootLocator() {
    return this.rootLocator;
  }

  public createElementFromLocator(locator: Locator): BaseElement {
    return new BaseElement(this.page, '', locator);
  }

  public getChildElementBySelector(selector: string): BaseElement {
    return this.createElementFromLocator(this.rootLocator.locator(selector));
  }

  async typeInInput(
    text: string,
    options?: { delay?: number; noWaitAfter?: boolean; timeout?: number },
  ) {
    await this.rootLocator.type(text, options);
  }

  async click(options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
    force?: boolean;
    noWaitAfter?: boolean;
    position?: { x: number; y: number };
    timeout?: number;
  }) {
    await this.rootLocator.click(options);
  }

  async isVisible(options?: { timeout?: number }) {
    return this.rootLocator.isVisible(options);
  }

  async waitForState(options?: {
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
    timeout?: number;
  }) {
    await this.rootLocator.waitFor(options);
  }
}
