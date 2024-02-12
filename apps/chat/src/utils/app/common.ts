import { getFoldersFromPaths } from '@/src/utils/app/folders';

import { ConversationInfo } from '@/src/types/chat';
import { Entity } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { PromptInfo } from '@/src/types/prompt';

/**
 * Combine entities. If there are the same ids then will be used entity from entities1 i.e. first in array
 * @param entities1
 * @param entities2
 * @returns new array without duplicates
 */
export const combineEntities = <T extends Entity>(
  entities1: T[],
  entities2: T[],
): T[] => {
  return entities1
    .concat(entities2)
    .filter(
      (entity, index, self) =>
        index === self.findIndex((c) => c.id === entity.id),
    );
};

export const updateEntitiesFoldersAndIds = (
  entities: PromptInfo[] | ConversationInfo[],
  folders: FolderInterface[],
  updateFolderId: (folderId: string | undefined) => string | undefined,
  openedFoldersIds: string[],
) => {
  const allFolderIds = entities.map((prompt) => prompt.folderId as string);

  const updatedExistedFolders = folders.map((f: FolderInterface) => ({
    ...f,
    id: updateFolderId(f.id)!,
    folderId: updateFolderId(f.folderId),
  }));

  const newUniqueFolderIds = Array.from(new Set(allFolderIds)).map((id) =>
    updateFolderId(id),
  );

  const updatedFolders = combineEntities(
    getFoldersFromPaths(newUniqueFolderIds, FolderType.Chat),
    updatedExistedFolders,
  );

  const updatedOpenedFoldersIds = openedFoldersIds.map(
    (id) => updateFolderId(id)!,
  );

  return { updatedFolders, updatedOpenedFoldersIds };
};
