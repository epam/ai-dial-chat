import { getNextDefaultName } from '@/src/utils/app/folders';

import { Conversation } from '@/src/types/chat';
import { Entity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

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

export const getSameLevelEntitiesWithUniqueNames = <
  T extends Prompt | Conversation,
>(
  entities: T[],
) => {
  const folderGroups: Record<string, Record<string, number>> = {};

  entities.forEach((entity) => {
    const folderId = entity.folderId || '';

    if (!folderGroups[folderId]) {
      folderGroups[folderId] = {};
    }
    if (!folderGroups[folderId][entity.name]) {
      folderGroups[folderId][entity.name] = 1;
    } else {
      folderGroups[folderId][entity.name]++;
      entity.name = getNextDefaultName(entity.name, entities);
    }
  });

  return entities;
};

export const filterOnlyMyEntities = <
  T extends Conversation | Prompt | FolderInterface,
>(
  entities: T[],
): T[] =>
  entities.filter((entity) => !entity.sharedWithMe && !entity.publishedWithMe);
