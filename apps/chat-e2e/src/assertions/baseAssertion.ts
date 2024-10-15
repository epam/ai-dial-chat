import { ExpectedMessages, Sorting } from '@/src/testData';
import { expect } from '@playwright/test';

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
}
