import {
  CheckboxState,
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
  Sorting,
} from '@/src/testData';
import { IconApiHelper } from '@/src/testData/api';
import { Attributes, Colors, Cursors, Styles } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { SortingUtil } from '@/src/utils/sortingUtil';
import { Locator, expect } from '@playwright/test';

export class BaseAssertion {
  public assertStringsSorting(arrayToSort: string[], sorting: Sorting) {
    const expectedOrder = SortingUtil.sortStringsArray(
      arrayToSort,
      (f) => f.toLowerCase(),
      sorting,
    );
    expect
      .soft(arrayToSort, ExpectedMessages.elementsOrderIsCorrect)
      .toEqual(expectedOrder);
  }

  public async assertEntityIcon(
    icon: Locator | BaseElement,
    expectedIconSource?: string,
  ) {
    const elementLocator = this.getElementLocator(icon);
    const actualIconSource = await elementLocator
      .getAttribute(Attributes.src)
      .then((s) => IconApiHelper.getNonCachedIconSource(s));
    //assert icon source is valid
    if (expectedIconSource) {
      expect
        .soft(actualIconSource, ExpectedMessages.entityIconIsValid)
        .toBe(expectedIconSource);
    }
    //assert icon is loaded and displayed
    await expect(elementLocator).toHaveJSProperty('complete', true);
    await expect(elementLocator).not.toHaveJSProperty('naturalWidth', 0);
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
    if (actualList.length > 0) {
      unexpectedItems.forEach((unexpectedItem) => {
        expect
          .soft(
            actualList,
            `${assertionMessage} - Unexpected item: "${unexpectedItem}"`,
          )
          .not.toContain(unexpectedItem);
      });
    }
  }

  public async assertElementActionabilityState(
    element: BaseElement | Locator,
    expectedState: ElementActionabilityState,
    expectedMessage?: string,
  ) {
    const elementLocator = this.getElementLocator(element);
    expectedState == 'enabled'
      ? await expect
          .soft(
            elementLocator,
            expectedMessage ?? ExpectedMessages.elementIsEnabled,
          )
          .toBeEnabled()
      : await expect
          .soft(
            elementLocator,
            expectedMessage ?? ExpectedMessages.elementIsDisabled,
          )
          .toBeDisabled();
  }

  public async assertElementState(
    element: BaseElement | Locator,
    expectedState: ElementState = 'visible',
    expectedMessage?: string,
  ) {
    const elementLocator = this.getElementLocator(element);
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
    expectedText: string | RegExp,
    expectedMessage?: string,
  ) {
    const elementLocator = this.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.fieldValueIsValid,
      )
      .toHaveText(expectedText);
  }

  public async assertInputValue(
    element: BaseElement | Locator,
    expectedValue: string,
    expectedMessage?: string,
  ) {
    const elementLocator = this.getElementLocator(element);
    // Use Playwright's recommended matcher for input values
    await expect(
      elementLocator,
      expectedMessage ?? ExpectedMessages.fieldValueIsValid,
    ).toHaveValue(expectedValue);
  }

  public async assertElementAttribute(
    element: BaseElement | Locator,
    attribute: string,
    expectedValue: string,
    expectedMessage?: string,
  ) {
    const elementLocator = this.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.elementAttributeValueIsValid,
      )
      .toHaveAttribute(attribute, expectedValue);
  }

  public async assertCheckboxState(
    element: BaseElement | Locator,
    expectedState: CheckboxState,
  ) {
    const elementLocator = this.getElementLocator(element);
    expectedState === CheckboxState.checked
      ? await expect
          .soft(elementLocator, ExpectedMessages.entityIsChecked)
          .toBeChecked()
      : await expect
          .soft(elementLocator, ExpectedMessages.entityIsNotChecked)
          .not.toBeChecked();
  }

  public async assertElementClass(
    element: BaseElement | Locator,
    expectedValue: string | RegExp,
  ) {
    const elementLocator = this.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        `${ExpectedMessages.elementAttributeValueShouldBe}${expectedValue}`,
      )
      .toHaveClass(expectedValue);
  }

  public async assertElementBorderColors(
    element: BaseElement | Locator,
    expectedColor: string,
  ) {
    const elementLocator = this.getElementLocator(element);
    for (const border of [
      Styles.borderBottomColor,
      Styles.borderLeftColor,
      Styles.borderRightColor,
      Styles.borderTopColor,
    ]) {
      await expect(
        elementLocator,
        ExpectedMessages.borderColorsAreValid,
      ).toHaveCSS(border, expectedColor);
    }
  }

  public async assertElementBackgroundColors(
    element: BaseElement | Locator,
    expectedColor?: string,
  ) {
    const elementLocator = this.getElementLocator(element);
    if (expectedColor !== undefined) {
      await expect(
        elementLocator,
        ExpectedMessages.entityBackgroundColorIsValid,
      ).toHaveCSS(Styles.backgroundColor, expectedColor);
    } else {
      await expect(
        elementLocator,
        ExpectedMessages.entityBackgroundColorIsValid,
      ).toHaveCSS(Styles.backgroundColor, Colors.defaultBackground);
    }
  }

  public async assertElementColor(
    element: BaseElement | Locator,
    expectedColor: string,
  ) {
    const elementLocator = this.getElementLocator(element);
    await expect(
      elementLocator,
      ExpectedMessages.entityBackgroundColorIsValid,
    ).toHaveCSS(Styles.color, expectedColor);
  }

  public async assertIsElementFocused(
    element: BaseElement | Locator,
    isFocused: boolean,
  ) {
    const elementLocator = this.getElementLocator(element);
    isFocused
      ? await expect(
          elementLocator,
          ExpectedMessages.elementIsInFocus,
        ).toBeFocused()
      : await expect(
          elementLocator,
          ExpectedMessages.elementIsNotInFocus,
        ).not.toBeFocused();
  }

  public async assertElementCursor(
    element: BaseElement | Locator,
    cursor: Cursors,
  ) {
    const elementLocator = this.getElementLocator(element);
    await expect(
      elementLocator,
      ExpectedMessages.elementCursorIsValid,
    ).toHaveCSS(Styles.cursor, cursor);
  }

  public async assertStringTruncatedTo160(
    originalString: string | null | undefined,
    truncatedString: string | null | undefined,
  ) {
    const maxLength = 160;

    // Handle null or undefined input
    if (originalString == null || truncatedString == null) {
      expect
        .soft(originalString, 'Original string should not be null or undefined')
        .not.toBeNull();
      expect
        .soft(
          truncatedString,
          'Truncated string should not be null or undefined',
        )
        .not.toBeNull();
      return;
    }

    // Handle strings shorter than the maximum length
    if (originalString.length <= maxLength) {
      expect
        .soft(truncatedString, 'String should not be truncated')
        .toBe(originalString);
      return;
    }

    // Assert that the truncated string has the correct length
    expect
      .soft(
        truncatedString.length,
        'Truncated string should have a length of 160',
      )
      .toBe(maxLength);
    // Assert that the truncated string is a substring of the original
    expect
      .soft(
        truncatedString,
        'Truncated string should be a substring of the original',
      )
      .toBe(originalString.substring(0, maxLength));
  }

  public async assertElementsCount(
    element: BaseElement | Locator,
    expectedCount: number,
    expectedMessage?: string,
  ) {
    const elementsCount = await this.getElementLocator(element).count();
    expect
      .soft(
        elementsCount,
        expectedMessage ?? ExpectedMessages.elementsCountIsValid,
      )
      .toBe(expectedCount);
  }

  public assertNumberIsGreaterThan(
    actualNumber: number,
    expectedNumber: number,
    expectedMessage?: string,
  ) {
    expect
      .soft(
        actualNumber,
        expectedMessage ?? ExpectedMessages.elementsCountIsValid,
      )
      .toBeGreaterThan(expectedNumber);
  }

  public assertValue(
    actualValue: string | number | undefined | null,
    expectedValue: string | number,
    expectedMessage?: string,
  ) {
    expect.soft(actualValue, expectedMessage ?? '').toBe(expectedValue);
  }

  public async assertElementInnerText(
    element: BaseElement | Locator,
    expectedInnerText: string[],
    expectedMessage?: string,
  ) {
    const elementLocator = this.getElementLocator(element);
    expect
      .soft(
        await elementLocator.allInnerTexts(),
        expectedMessage ?? ExpectedMessages.elementTextIsValid,
      )
      .toEqual(expectedInnerText);
  }

  private getElementLocator(element: BaseElement | Locator) {
    return element instanceof BaseElement
      ? element.getElementLocator()
      : (element as Locator);
  }
}
