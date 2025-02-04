import { Sorting } from '@/src/testData';

export class SortingUtil {
  public static sortObjects(
    objects: T[],
    orderByProperties: string[],
    orders: Sorting[] = [],
  ): T[] {
    const sortedObjects = [...objects];
    sortedObjects.sort((a, b) => {
      for (let i = 0; i < orderByProperties.length; i++) {
        const property = orderByProperties[i];
        const order = orders[i] || 'asc';
        if (a[property] < b[property]) {
          return order === 'asc' ? -1 : 1;
        }
        if (a[property] > b[property]) {
          return order === 'asc' ? 1 : -1;
        }
      }
      return 0;
    });
    return sortedObjects;
  }
}
