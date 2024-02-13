import { notAllowedSymbolsRegex } from '@/src/utils/app/file';
import { getFoldersFromPaths } from '@/src/utils/app/folders';

import { Conversation } from '@/src/types/chat';
import { ConversationInfo } from '@/src/types/chat';
import { Entity } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { PromptInfo } from '@/src/types/prompt';

import { MAX_ENTITY_LENGTH } from '@/src/constants/default-settings';

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

export const isEntityNameOnSameLevelUnique = <
  T extends Conversation | Prompt | FolderInterface,
>(
  nameToBeUnique: string,
  entity: T,
  entities: T[],
): boolean => {
  const sameLevelEntities = entities.filter(
    (e) =>
      entity.id !== e.id &&
      (e.folderId === entity.folderId || (!entity.folderId && !e.folderId)),
  );
  return !sameLevelEntities.some((e) => nameToBeUnique === e.name);
};

export const filterOnlyMyEntities = <
  T extends Conversation | Prompt | FolderInterface,
>(
  entities: T[],
): T[] =>
  entities.filter((entity) => !entity.sharedWithMe && !entity.publishedWithMe);

export const filterMigratedEntities = <T extends Conversation | Prompt>(
  entities: T[],
  migratedEntityIds: string[],
  notMigrated = false,
): T[] =>
  entities.filter((entity) =>
    notMigrated
      ? !migratedEntityIds.includes(entity.id)
      : migratedEntityIds.includes(entity.id),
  );

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

export const prepareEntityName = (name: string, defaultName: string) => {
  const clearName =
    name.trim().replace(notAllowedSymbolsRegex, '') || defaultName;

  if (clearName.length > MAX_ENTITY_LENGTH) {
    return clearName.substring(0, MAX_ENTITY_LENGTH - 3) + '...';
  }

  return clearName;
};
