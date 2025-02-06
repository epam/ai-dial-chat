import { BackendChatEntity } from '@/chat/types/common';

export class SortingUtil {
  public static sortBackendConversationsByDateAndName(
    entities: BackendChatEntity[],
  ): BackendChatEntity[] {
    return entities.sort((a, b) => {
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
    });
  }
}
