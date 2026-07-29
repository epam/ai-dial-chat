import { Attributes, Styles, Tags } from '../domData';

import { ScrollState } from '@/src/testData';
import { ChatSelectors } from '@/src/ui/selectors';
import { Locator, Page } from '@playwright/test';
import path from 'path';

export const elementIndexExceptionError = 'Element index should start from 1';

export interface EntityIcon {
  entityId: string;
  iconLocator: Locator;
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

  public getElementLocator() {
    return this.rootLocator;
  }

  public setElementLocator(rootLocator: Locator) {
    this.rootLocator = rootLocator;
  }

  public createElementFromLocator(locator: Locator): BaseElement {
    return new BaseElement(this.page, '', locator);
  }

  public getChildElementBySelector(selector: string): BaseElement {
    return this.createElementFromLocator(this.rootLocator.locator(selector));
  }

  public getChildButtonElement(): BaseElement {
    return this.getChildElementBySelector(Tags.button);
  }

  public getElementLocatorByText(
    text: string | RegExp,
    index?: number,
  ): Locator {
    if (index === 0) {
      throw new Error(elementIndexExceptionError);
    }
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
    await this.rootLocator.pressSequentially(text, options);
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

  async hoverOver(options?: { force?: boolean }) {
    await this.rootLocator.hover(options);
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

  async getElementsInnerHtml() {
    return this.rootLocator.innerHTML();
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

  async isElementEnabled(options?: { timeout?: number }) {
    return this.rootLocator.isEnabled(options);
  }

  async scrollIntoElementView() {
    await this.rootLocator.scrollIntoViewIfNeeded();
  }

  async getElementInputValue() {
    return this.rootLocator.inputValue();
  }

  async setElementInputFiles(filesDirectory: string, ...filenames: string[]) {
    await this.rootLocator.setInputFiles(
      filenames.map((filename) => path.join(filesDirectory, filename)),
    );
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

  /**
   * Waits for the scroll position to stabilize (stop changing) before returning.
   * This helps avoid race conditions when auto-scroll is still in progress.
   */
  private async waitForScrollStabilization(
    stabilityThresholdMs = 100,
  ): Promise<void> {
    const element = await this.rootLocator.elementHandle();
    if (!element) return;

    await this.page.waitForFunction(
      ([el, threshold]) => {
        return new Promise<boolean>((resolve) => {
          const initialScrollTop = el.scrollTop;
          setTimeout(() => {
            resolve(el.scrollTop === initialScrollTop);
          }, threshold);
        });
      },
      [element, stabilityThresholdMs] as const,
      { timeout: 1000 },
    );
  }

  public async getVerticalScrollPosition(): Promise<ScrollState> {
    // Wait for scroll to stabilize before checking position
    await this.waitForScrollStabilization();

    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    const scrollTop = await this.rootLocator.evaluate((p) => p.scrollTop);
    const clientHeight = await this.rootLocator.evaluate((p) => p.clientHeight);

    // Use tolerance of 3 pixels to account for subpixel rendering differences
    const scrollTolerance = 3;

    if (scrollTop < scrollTolerance) {
      return ScrollState.top;
    } else if (scrollHeight - (scrollTop + clientHeight) < scrollTolerance) {
      return ScrollState.bottom;
    }
    return ScrollState.middle;
  }

  public async scrollToTheEnd() {
    await this.getElementLocator().evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }

  public async getScrollTop() {
    return this.getElementLocator().evaluate((el) => el.scrollTop);
  }

  public async getElementCursorPosition(element: BaseElement) {
    return element
      .getElementLocator()
      .evaluate(
        (el: HTMLTextAreaElement) => el.selectionStart ?? el.value.length,
      );
  }

  public async getElementIcons(elements: BaseElement) {
    const allIcons: EntityIcon[] = [];
    const elementsCount = await elements.getElementsCount();
    for (let i = 1; i <= elementsCount; i++) {
      const element = elements.getNthElement(i);
      const elementIconLocator = this.getElementIcon(element);
      const elementIconId = await elementIconLocator.getAttribute(
        Attributes.id,
      );
      allIcons.push({
        entityId: elementIconId!,
        iconLocator: elementIconLocator,
      });
    }
    return allIcons;
  }

  public getElementIcon(elementLocator: Locator | BaseElement) {
    const iconLocator = BaseElement.getElementLocator(elementLocator)
      .locator(ChatSelectors.iconSelector)
      .first();
    return iconLocator.locator(`${Tags.img}:visible`);
  }

  public static getElementLocator(element: BaseElement | Locator): Locator {
    return element instanceof BaseElement
      ? element.getElementLocator()
      : (element as Locator);
  }
}
