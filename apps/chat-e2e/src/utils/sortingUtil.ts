import { BackendChatEntity } from '@/chat/types/common';
import { Sorting } from '@/src/testData';

export class SortingUtil {
  public static sortBackendConversationsByDateAndName(
    entities: BackendChatEntity[],
  ): BackendChatEntity[] {
    return entities.sort((a, b) => compareBackendConversations(a, b));
  }

  public static sortStringsArray(
    array: string[],
    iteratee: (item: string) => string,
    sorting: Sorting,
  ): string[] {
    const sortedArray = array
      .slice()
      .sort((a, b) => compareStrings(a, b, iteratee));
    return sorting === 'asc' ? sortedArray : sortedArray.reverse();
  }

  public static sortVersionsArray(array: string[]): string[] {
    return array.sort((a, b) => compareVersions(a, b));
  }
}

function compareStrings(
  a: string,
  b: string,
  iteratee: (item: string) => string,
): number {
  const valueA = iteratee(a);
  const valueB = iteratee(b);
  if (valueA > valueB) return 1;
  if (valueA < valueB) return -1;
  return 0;
}

function compareBackendConversations(
  a: BackendChatEntity,
  b: BackendChatEntity,
): number {
  // Sort by updatedAt in descending order
  const dateComparison = b.updatedAt - a.updatedAt;
  if (dateComparison !== 0) {
    return dateComparison;
  }
  // If updatedAt is the same, sort by name in descending order
  const nameA = a.name.toLowerCase();
  const nameB = b.name.toLowerCase();
  if (nameA < nameB) {
    return 1;
  }
  if (nameA > nameB) {
    return -1;
  }
  return 0;
}

//algorithm for semver versions sorting
function compareVersions(v1: string, v2: string): number {
  const v1Parts = v1.split('.').map(String);
  const v2Parts = v2.split('.').map(String);
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const part1 = parseInt(v1Parts[i] || '0');
    const part2 = parseInt(v2Parts[i] || '0');
    if (part1 > part2) {
      return -1;
    }
    if (part1 < part2) {
      return 1;
    }
  }
  return 0;
}
