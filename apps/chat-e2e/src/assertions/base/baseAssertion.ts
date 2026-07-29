import {
  CheckboxState,
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
  Sorting,
} from '@/src/testData';
import { IconApiHelper } from '@/src/testData/api';
import {
  AttributeValues,
  Attributes,
  Colors,
  Cursors,
  Overflow,
  StyleValues,
  Styles,
} from '@/src/ui/domData';
import { Properties } from '@/src/ui/domData/properties';
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
    this.assertValuesAreEqual(
      arrayToSort,
      expectedOrder,
      ExpectedMessages.elementsOrderIsCorrect,
    );
  }

  public async assertEntityIcon(
    icon: Locator | BaseElement,
    expectedIconSource?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(icon);
    //assert icon is loaded and displayed
    await expect
      .soft(elementLocator, ExpectedMessages.imageIsLoaded)
      .toHaveJSProperty('complete', true);
    await expect
      .soft(elementLocator, ExpectedMessages.imageIsLoaded)
      .not.toHaveJSProperty('naturalWidth', 0);

    const actualIconSource = await elementLocator
      .getAttribute(Attributes.src)
      .then((s) => IconApiHelper.getNonCachedIconSource(s));
    //assert icon source is valid
    if (expectedIconSource) {
      expect
        .soft(actualIconSource, ExpectedMessages.entityIconIsValid)
        .toBe(expectedIconSource);
    }
  }

  public assertArrayIncludesAll(
    actualList: unknown[],
    expectedItems: unknown[],
    assertionMessage: string,
  ) {
    expectedItems.forEach((expectedItem) => {
      expect
        .soft(
          actualList,
          `${assertionMessage} - Expected item: "${expectedItem}"`,
        )
        .toContainEqual(expectedItem);
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
    const elementLocator = BaseElement.getElementLocator(element);
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
    const elementLocator = BaseElement.getElementLocator(element);
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
    expectedText: string | RegExp | number | (string | RegExp)[],
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    expectedText =
      typeof expectedText === 'number' ? expectedText.toString() : expectedText;
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.fieldValueIsValid,
      )
      .toHaveText(expectedText);
  }

  public async assertElementContainsText(
    element: BaseElement | Locator,
    expectedText: string | RegExp | (string | RegExp)[],
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.fieldValueIsValid,
      )
      .toContainText(expectedText);
  }

  public async assertElementDoesNotContainText(
    element: BaseElement | Locator,
    expectedText: string | RegExp | (string | RegExp)[],
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.fieldValueIsValid,
      )
      .not.toContainText(expectedText);
  }

  public async assertElementInnerHtml(
    element: BaseElement | Locator,
    expectedHtml: string | RegExp,
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    expect
      .soft(
        await elementLocator.innerHTML(),
        expectedMessage ?? ExpectedMessages.fieldInnerHtmlIsValid,
      )
      .toBe(expectedHtml);
  }

  public async assertInputValue(
    element: BaseElement | Locator,
    expectedValue: string | RegExp,
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    // Use Playwright's recommended matcher for input values
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.fieldValueIsValid,
      )
      .toHaveValue(expectedValue);
  }

  public async assertElementAttribute(
    element: BaseElement | Locator,
    attribute: string,
    expectedValue: string | RegExp,
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.elementAttributeValueIsValid,
      )
      .toHaveAttribute(attribute, expectedValue);
  }

  public async assertElementAttributeAbsence(
    element: BaseElement | Locator,
    attribute: string,
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.elementAttributeValueShouldNotBe,
      )
      .not.toHaveAttribute(attribute);
  }

  public async assertCheckboxState(
    element: BaseElement | Locator,
    expectedState: CheckboxState,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
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
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ??
          `${ExpectedMessages.elementAttributeValueShouldBe}${expectedValue}`,
      )
      .toHaveClass(expectedValue);
  }

  public async assertElementBorderColors(
    element: BaseElement | Locator,
    expectedColor: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    for (const border of [
      Styles.borderBottomColor,
      Styles.borderLeftColor,
      Styles.borderRightColor,
      Styles.borderTopColor,
    ]) {
      await expect
        .soft(elementLocator, ExpectedMessages.borderColorsAreValid)
        .toHaveCSS(border, expectedColor);
    }
  }

  public async assertElementBackgroundColors(
    element: BaseElement | Locator,
    expectedColor?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    if (expectedColor !== undefined) {
      await expect
        .soft(elementLocator, ExpectedMessages.entityBackgroundColorIsValid)
        .toHaveCSS(Styles.backgroundColor, expectedColor);
    } else {
      await expect
        .soft(elementLocator, ExpectedMessages.entityBackgroundColorIsValid)
        .toHaveCSS(Styles.backgroundColor, Colors.defaultBackground);
    }
  }

  public async assertElementColor(
    element: BaseElement | Locator,
    expectedColor: string,
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.entityBackgroundColorIsValid,
      )
      .toHaveCSS(Styles.color, expectedColor);
  }

  public async assertElementTextIsSelected(element: BaseElement | Locator) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(elementLocator, ExpectedMessages.elementTextIsSelected)
      .toHaveJSProperty(Properties.selectionStart, 0);
  }

  public async assertIsElementFocused(
    element: BaseElement | Locator,
    isFocused: boolean,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    isFocused
      ? await expect
          .soft(elementLocator, ExpectedMessages.elementIsInFocus)
          .toBeFocused()
      : await expect
          .soft(elementLocator, ExpectedMessages.elementIsNotInFocus)
          .not.toBeFocused();
  }

  public async assertElementIsInViewport(
    element: BaseElement | Locator,
    ratio?: number,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(elementLocator, ExpectedMessages.elementIsInFocus)
      .toBeInViewport({ ratio: ratio });
  }

  public async assertElementCursor(
    element: BaseElement | Locator,
    cursor: Cursors,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(elementLocator, ExpectedMessages.elementCursorIsValid)
      .toHaveCSS(Styles.cursor, cursor);
  }

  public async assertStringTruncatedTo255(
    originalString: string | null | undefined,
    truncatedString: string | null | undefined,
  ) {
    const maxLength = 255;

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
      .soft(truncatedString, 'Truncated string should have a length of 255')
      .toHaveLength(maxLength);
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
    await expect
      .soft(
        BaseElement.getElementLocator(element),
        expectedMessage ?? ExpectedMessages.elementsCountIsValid,
      )
      .toHaveCount(expectedCount);
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

  public assertNumberIsGreaterThanOrEqual(
    actualNumber: number,
    expectedNumber: number,
    expectedMessage?: string,
  ) {
    expect
      .soft(
        actualNumber,
        expectedMessage ?? ExpectedMessages.elementsCountIsValid,
      )
      .toBeGreaterThanOrEqual(expectedNumber);
  }

  public assertNumberIsLessThanOrEqual(
    actualNumber: number,
    expectedNumber: number,
    expectedMessage?: string,
  ) {
    expect
      .soft(
        actualNumber,
        expectedMessage ?? ExpectedMessages.elementsCountIsValid,
      )
      .toBeLessThanOrEqual(expectedNumber);
  }

  public assertValue(
    actualValue: string | number | undefined | null,
    expectedValue: string | number | undefined,
    expectedMessage?: string,
  ) {
    expect.soft(actualValue, expectedMessage ?? '').toBe(expectedValue);
  }

  public assertStringIncludes(
    actualValue: string,
    expectedValue: string,
    expectedMessage?: string,
  ) {
    expect.soft(actualValue, expectedMessage ?? '').toContain(expectedValue);
  }

  public assertStringNotIncludes(
    actualValue: string,
    expectedValue: string,
    expectedMessage?: string,
  ) {
    expect
      .soft(actualValue, expectedMessage ?? '')
      .not.toContain(expectedValue);
  }

  public async assertElementInnerText(
    element: BaseElement | Locator,
    expectedInnerText: string[],
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    this.assertValuesAreEqual(
      await elementLocator.allInnerTexts(),
      expectedInnerText,
      expectedMessage ?? ExpectedMessages.elementTextIsValid,
    );
  }

  public async assertElementTextWrap(
    element: BaseElement | Locator,
    expectedWrap: Overflow | StyleValues,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(elementLocator, ExpectedMessages.elementTextWrapIsValid)
      .toHaveCSS(Styles.overflow_wrap, expectedWrap);
  }

  /**
   * The 'truncate' class refers to Tailwind CSS utility class that truncates overflowing text with an ellipsis
   * The truncate class applies these CSS properties:
   * - overflow: hidden;
   * - text-overflow: ellipsis;
   * - white-space: nowrap;
   */
  public async assertElementTextIsTruncated(
    element: BaseElement | Locator,
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await this.assertElementClass(
      elementLocator,
      new RegExp(AttributeValues.truncate),
      expectedMessage ?? ExpectedMessages.elementTextIsTruncated,
    );
  }

  /**
   * The 'line-clamp-*' class refers to Tailwind CSS utility class that truncates overflowing text after multiple lines
   */
  public async assertElementMultilineTextIsTruncated(
    element: BaseElement | Locator,
    linesCount: number,
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await this.assertElementClass(
      elementLocator,
      new RegExp(AttributeValues.lineClamp + linesCount),
      expectedMessage ?? ExpectedMessages.elementTextIsTruncated,
    );
  }

  /**
   * <input> element specific assertion.
   * The input value is truncated with dots when the following CSS props are applied:
   * - text-overflow: ellipsis
   * - overflow-x:clip
   */
  public async assertInputValueIsTruncated(
    element: BaseElement | Locator,
    expectedMessage?: string,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.elementTextIsTruncated,
      )
      .toHaveCSS(Styles.text_overflow, Overflow.ellipsis);
    await expect
      .soft(
        elementLocator,
        expectedMessage ?? ExpectedMessages.elementTextIsTruncated,
      )
      .toHaveCSS(Styles.overflow_x, Overflow.clip);
  }

  public async assertElementDisplayStyle(
    element: BaseElement | Locator,
    expectedDisplay: Overflow | StyleValues,
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    await expect
      .soft(elementLocator, ExpectedMessages.elementTextWrapIsValid)
      .toHaveCSS(Styles.display, expectedDisplay);
  }

  public async assertElementWidthStyle(
    element: BaseElement | Locator,
    option: { hasFullWidth: boolean },
  ) {
    const elementLocator = BaseElement.getElementLocator(element);
    option.hasFullWidth
      ? await expect
          .soft(elementLocator, ExpectedMessages.elementWidthIsValid)
          .toHaveCSS(Styles.maxWidth, StyleValues.none)
      : await expect
          .soft(elementLocator, ExpectedMessages.elementWidthIsValid)
          .not.toHaveCSS(Styles.maxWidth, StyleValues.none);
  }

  public assertBooleanCondition(
    predicate: boolean,
    expectedResult: boolean,
    expectedMessage: string,
  ) {
    expectedResult
      ? expect.soft(predicate, expectedMessage).toBeTruthy()
      : expect.soft(predicate, expectedMessage).toBeFalsy();
  }

  public assertValuesAreEqual(
    actualValue: unknown,
    expectedValue: unknown,
    expectedMessage?: string,
  ) {
    expect
      .soft(actualValue, expectedMessage ?? ExpectedMessages.valuesAreEqual)
      .toEqual(expectedValue);
  }

  public assertValueIsNotUndefined(
    actualValue: unknown,
    expectedMessage?: string,
  ) {
    expect
      .soft(actualValue, expectedMessage ?? ExpectedMessages.valueIsDefined)
      .toBeDefined();
  }

  public async assertScrollPosition(
    element: BaseElement | Locator,
    scrollProperty: Properties,
    expectedValue: number,
  ) {
    await expect
      .soft(
        BaseElement.getElementLocator(element),
        ExpectedMessages.scrollPositionIsCorrect,
      )
      .toHaveJSProperty(scrollProperty, expectedValue);
  }

  public async assertCursorPosition(
    element: BaseElement | Locator,
    expectedPosition: number,
    expectedMessage?: string,
  ) {
    await expect
      .soft(
        BaseElement.getElementLocator(element),
        expectedMessage ?? ExpectedMessages.cursorPositionIsValid,
      )
      .toHaveJSProperty(Properties.selectionStart, expectedPosition);
  }

  public assertValueMatchObject(
    actualValue: unknown,
    expectedObject: Record<string, unknown> | Array<unknown>,
    expectedMessage?: string,
  ) {
    expect
      .soft(actualValue, expectedMessage ?? ExpectedMessages.valuesAreEqual)
      .toMatchObject(expectedObject);
  }

  public assertValueMatchPattern(
    actualValue: unknown,
    expectedObject: RegExp | string,
    expectedMessage?: string,
  ) {
    expect
      .soft(actualValue, expectedMessage ?? ExpectedMessages.valueMatchPattern)
      .toMatch(expectedObject);
  }
}
