import { Styles } from '../domData';

import { Locator, Page } from '@playwright/test';

export class BaseElement {
  protected page: Page;
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

  public getElementLocatorByText(text: string, index?: number): Locator {
    return this.rootLocator.getByText(text).nth(index ?? 0);
  }

  async typeInInput(
    text: string,
    options?: { delay?: number; noWaitAfter?: boolean; timeout?: number },
  ) {
    await this.rootLocator.type(text, options);
  }

  async fillInInput(
    text: string,
    options?: { force?: boolean; noWaitAfter?: boolean; timeout?: number },
  ) {
    await this.rootLocator.fill(text, options);
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

  async getElementContent() {
    return this.rootLocator.innerText();
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

  async getElementsCount() {
    return this.rootLocator.all().then((items) => items.length);
  }

  async getAttribute(attribute: string) {
    return this.rootLocator.getAttribute(attribute);
  }

  async getAllBorderBottomColors() {
    const allBorderColors: {
      bottomBorderColors: string[];
      topBorderColors: string[];
      leftBorderColors: string[];
      rightBorderColors: string[];
    } = {
      bottomBorderColors: [],
      topBorderColors: [],
      leftBorderColors: [],
      rightBorderColors: [],
    };
    const bottomBorderColor = await this.getComputedStyleProperty(
      Styles.borderBottomColor,
    );
    const topBorderColor = await this.getComputedStyleProperty(
      Styles.borderTopColor,
    );
    const leftBorderColor = await this.getComputedStyleProperty(
      Styles.borderLeftColor,
    );
    const rightBorderColor = await this.getComputedStyleProperty(
      Styles.borderRightColor,
    );
    allBorderColors.bottomBorderColors = bottomBorderColor;
    allBorderColors.topBorderColors = topBorderColor;
    allBorderColors.leftBorderColors = leftBorderColor;
    allBorderColors.rightBorderColors = rightBorderColor;
    return allBorderColors;
  }

  private async getComputedStyleProperty(property: string) {
    return this.rootLocator.evaluateAll((elems, property) => {
      return Promise.all(
        elems.map((elem) =>
          window.getComputedStyle(elem).getPropertyValue(property),
        ),
      );
    }, property);
  }
}
