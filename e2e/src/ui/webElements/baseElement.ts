import { Attributes, Styles } from '../domData';

import { Locator, Page } from '@playwright/test';

export interface Icons {
  iconEntity: string;
  iconUrl: string | undefined;
}

export class BaseElement {
  protected page: Page;
  protected rootSelector: string;
  protected rootLocator: Locator;

  constructor(page: Page, selector: string, locator?: Locator) {
    this.page = page;
    if (locator) {
      this.rootLocator = selector ? locator.locator(selector) : locator;
    } else {
      this.rootLocator = this.page.locator(selector);
    }
    this.rootSelector = selector;
  }

  public createElementFromLocator(locator: Locator): BaseElement {
    return new BaseElement(this.page, '', locator);
  }

  public getChildElementBySelector(selector: string): BaseElement {
    return this.createElementFromLocator(this.rootLocator.locator(selector));
  }

  public getElementLocatorByText(
    text: string | RegExp,
    index?: number,
  ): Locator {
    return this.rootLocator
      .filter({ hasText: text })
      .nth(index ? index - 1 : 0);
  }

  public getElementByPlaceholder(placeholder: string): Locator {
    return this.rootLocator.getByPlaceholder(placeholder);
  }

  public getNthElement(index: number): Locator {
    return this.rootLocator.nth(index - 1);
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

  async hoverOver() {
    await this.rootLocator.hover();
  }

  async getElementContent() {
    return this.rootLocator.textContent();
  }

  async getElementInnerContent() {
    return this.rootLocator.innerText();
  }

  async getElementsInnerContent() {
    return this.rootLocator.allInnerTexts();
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

  async getElementBoundingBox() {
    return this.rootLocator.boundingBox();
  }

  async isElementEnabled() {
    return this.rootLocator.isEnabled();
  }

  async scrollIntoElementView() {
    await this.rootLocator.scrollIntoViewIfNeeded();
  }

  async getAllBorderColors() {
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

  public async getComputedStyleProperty(property: string) {
    return this.rootLocator.evaluateAll((elems, property) => {
      return Promise.all(
        elems.map((elem) =>
          window.getComputedStyle(elem).getPropertyValue(property),
        ),
      );
    }, property);
  }

  public async isElementWidthTruncated() {
    const clientWidth = await this.rootLocator.evaluate((t) => t.clientWidth);
    const scrollWidth = await this.rootLocator.evaluate((t) => t.scrollWidth);
    return scrollWidth > clientWidth;
  }

  public async isElementScrollableVertically() {
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    const clientHeight = await this.rootLocator.evaluate((p) => p.clientHeight);
    return scrollHeight > clientHeight;
  }

  public async getElementIconAttributes(
    elementLocator: Locator,
  ): Promise<Icons> {
    const iconEntity = await elementLocator.getAttribute(Attributes.alt);
    const iconUrl = await elementLocator.getAttribute(Attributes.src);
    return {
      iconEntity: iconEntity!.replaceAll(' icon', ''),
      iconUrl: iconUrl!,
    };
  }

  public async getElementDefaultIconAttributes(
    elementLocator: Locator,
  ): Promise<Icons> {
    const defaultIconEntity = await elementLocator.getByRole('img');
    const defaultIconEntityName = await defaultIconEntity.getAttribute(
      Attributes.ariaLabel,
    );
    return {
      iconEntity: defaultIconEntityName!.replaceAll(' icon', ''),
      iconUrl: undefined,
    };
  }
}
