import {
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
  Sorting,
} from '@/src/testData';
import { IconApiHelper } from '@/src/testData/api';
import { Attributes, Styles } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, expect } from '@playwright/test';

export class BaseAssertion {
  public async assertStringsSorting(arrayToSort: string[], sorting: Sorting) {
    const expectedOrder = this.sortStringsArray(
      arrayToSort,
      (f) => f.toLowerCase(),
      sorting,
    );
    expect
      .soft(arrayToSort, ExpectedMessages.elementsOrderIsCorrect)
      .toEqual(expectedOrder);
  }

  public sortStringsArray(
    array: string[],
    iteratee: (item: string) => string,
    sorting: Sorting,
  ): string[] {
    const sortedArray = array.slice().sort((a, b) => {
      const valueA = iteratee(a);
      const valueB = iteratee(b);
      if (valueA > valueB) return 1;
      if (valueA < valueB) return -1;
      return 0;
    });
    return sorting === 'asc' ? sortedArray : sortedArray.reverse();
  }

  public async assertEntityIcon(
    iconLocator: Locator,
    expectedIconSource?: string,
  ) {
    const actualIconSource = await iconLocator
      .getAttribute(Attributes.src)
      .then((s) => IconApiHelper.getNonCachedIconSource(s));
    //assert icon source is valid
    if (expectedIconSource) {
      expect
        .soft(actualIconSource, ExpectedMessages.entityIconIsValid)
        .toBe(expectedIconSource);
    }
    //assert icon is loaded and displayed
    await expect(iconLocator).toHaveJSProperty('complete', true);
    await expect(iconLocator).not.toHaveJSProperty('naturalWidth', 0);
  }

  public assertArrayIncludesAll(
    actualList: string[],
    expectedItems: string[],
    assertionMessage: string,
  ) {
    expectedItems.forEach((expectedItem) => {
      expect
        .soft(
          actualList,
          `${assertionMessage} - Expected item: "${expectedItem}"`,
        )
        .toContain(expectedItem);
    });
  }

  public assertArrayExcludesAll(
    actualList: string[],
    unexpectedItems: string[],
    assertionMessage: string,
  ) {
    unexpectedItems.forEach((unexpectedItem) => {
      expect
        .soft(
          actualList,
          `${assertionMessage} - Unexpected item: "${unexpectedItem}"`,
        )
        .not.toContain(unexpectedItem);
    });
  }

  public async assertElementActionabilityState(
    element: BaseElement,
    expectedState: ElementActionabilityState,
  ) {
    const elementLocator = element.getElementLocator();
    expectedState == 'enabled'
      ? await expect
          .soft(elementLocator, ExpectedMessages.elementIsEnabled)
          .toBeEnabled()
      : await expect
          .soft(elementLocator, ExpectedMessages.elementIsDisabled)
          .toBeDisabled();
  }

  public async assertElementState(
    element: BaseElement | Locator,
    expectedState: ElementState,
    expectedMessage?: string,
  ) {
    const elementLocator =
      element instanceof BaseElement
        ? element.getElementLocator()
        : (element as Locator);
    expectedState == 'visible'
      ? await expect
          .soft(
            elementLocator,
            expectedMessage ?? ExpectedMessages.elementIsVisible,
          )
          .toBeVisible()
      : await expect
          .soft(
            elementLocator,
            expectedMessage ?? ExpectedMessages.elementIsNotVisible,
          )
          .toBeHidden();
  }

  public async assertElementText(
    element: BaseElement | Locator,
    expectedText: string,
    expectedMessage?: string,
  ) {
    const elementLocator =
      element instanceof BaseElement
        ? element.getElementLocator()
        : (element as Locator);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.fieldValueIsValid,
      )
      .toHaveText(expectedText);
  }

  public async assertElementColor(element: BaseElement, expectedColor: string) {
    const style = await element.getComputedStyleProperty(Styles.color);
    expect
      .soft(style[0], ExpectedMessages.elementColorIsValid)
      .toBe(expectedColor);
  }

  public async assertElementsCount(
    element: BaseElement,
    expectedCount: number,
  ) {
    expect
      .soft(
        await element.getElementsCount(),
        ExpectedMessages.elementsCountIsValid,
      )
      .toBe(expectedCount);
  }
}
