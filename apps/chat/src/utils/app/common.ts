import { notAllowedSymbolsRegex } from '@/src/utils/app/file';
import { getFoldersFromIds } from '@/src/utils/app/folders';

import { Entity, ShareEntity } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';

import { MAX_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';

import uniq from 'lodash-es/uniq';

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

export const isEntityNameOnSameLevelUnique = (
  nameToBeUnique: string,
  entity: Entity,
  entities: Entity[],
): boolean => {
  const sameLevelEntities = entities.filter(
    (e) => entity.id !== e.id && e.folderId === entity.folderId,
  );

  return !sameLevelEntities.some((e) => nameToBeUnique === e.name);
};

export const isEntityNameInvalid = (name: string) => {
  return name.trim().endsWith('.');
};

export const filterOnlyMyEntities = <T extends ShareEntity>(
  entities: T[],
): T[] =>
  entities.filter((entity) => !entity.sharedWithMe && !entity.publishedWithMe);

export const filterMigratedEntities = <T extends Entity>(
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
  entities: Entity[],
  folders: FolderInterface[],
  updateFolderId: (folderId: string) => string,
  openedFoldersIds: string[],
) => {
  const allFolderIds = entities.map((prompt) => prompt.folderId as string);

  const updatedExistedFolders = folders.map((f: FolderInterface) => ({
    ...f,
    id: updateFolderId(f.id)!,
    folderId: updateFolderId(f.folderId),
  }));

  const newUniqueFolderIds = uniq(allFolderIds).map((id) => updateFolderId(id));

  const updatedFolders = combineEntities(
    getFoldersFromIds(newUniqueFolderIds, FolderType.Chat),
    updatedExistedFolders,
  );

  const updatedOpenedFoldersIds = openedFoldersIds.map(
    (id) => updateFolderId(id)!,
  );

  return { updatedFolders, updatedOpenedFoldersIds };
};

export const prepareEntityName = (name: string, forRenaming = false) => {
  const clearName = forRenaming
    ? name.replace(notAllowedSymbolsRegex, '').trim()
    : name
        .replace(/\r\n|\r/gm, '\n')
        .split('\n')
        .map((s) => s.replace(notAllowedSymbolsRegex, ' ').trim())
        .filter(Boolean)[0] ?? '';

  if (clearName.length > MAX_ENTITY_LENGTH) {
    return clearName.substring(0, MAX_ENTITY_LENGTH);
  }

  return clearName;
};
