import { Sorting } from '@/src/testData';

export class SortingUtil {
  public static sortStringsArray(
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

  //algorithm for semver versions sorting
  public static sortVersionsArray(array: string[]): string[] {
    function compareVersions(v1: string, v2: string): number {
      const v1Parts = v1.split('.').map(String);
      const v2Parts = v2.split('.').map(String);
      for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const part1 = v1Parts[i] || '0';
        const part2 = v2Parts[i] || '0';
        if (part1 > part2) {
          return -1;
        }
        if (part1 < part2) {
          return 1;
        }
      }
      return 0;
    }
    return array.sort((a, b) => compareVersions(a, b));
  }
}
