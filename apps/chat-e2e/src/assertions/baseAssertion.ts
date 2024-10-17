import { ExpectedMessages, Sorting } from '@/src/testData';
import { IconApiHelper } from '@/src/testData/api';
import { Attributes } from '@/src/ui/domData';
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
    expectedIconSource: string,
  ) {
    const actualIconSource = await iconLocator
      .getAttribute(Attributes.src)
      .then((s) => IconApiHelper.getNonCachedIconSource(s));
    //assert icon source is valid
    expect
      .soft(actualIconSource, ExpectedMessages.entityIconIsValid)
      .toBe(expectedIconSource);
    //assert icon is loaded and displayed
    await expect(iconLocator).toHaveJSProperty('complete', true);
    await expect(iconLocator).not.toHaveJSProperty('naturalWidth', 0);
  }
}
