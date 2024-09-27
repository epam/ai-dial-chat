import { notAllowedSymbolsRegex } from '@/src/utils/app/file';
import { getFoldersFromIds, splitEntityId } from '@/src/utils/app/folders';

import { PrepareNameOptions } from '@/src/types/chat';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { PublicVersionGroups } from '@/src/types/publication';
import { EntityFilters } from '@/src/types/search';

import { MAX_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';
import { NA_VERSION } from '@/src/constants/public';

import { getPublicItemIdWithoutVersion } from '../server/api';
import { doesEntityContainSearchTerm } from './search';

import { Entity, ShareEntity } from '@epam/ai-dial-shared';
import groupBy from 'lodash-es/groupBy';
import keyBy from 'lodash-es/keyBy';
import merge from 'lodash-es/merge';
import orderBy from 'lodash-es/orderBy';
import trimEnd from 'lodash-es/trimEnd';
import uniq from 'lodash-es/uniq';
import values from 'lodash-es/values';
import { substring } from 'stringz';

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
  const mergedEntities = merge(keyBy(entities2, 'id'), keyBy(entities1, 'id'));

  return values(mergedEntities);
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

export const isImportEntityNameOnSameLevelUnique = ({
  entity,
  entities,
}: {
  entity: Entity;
  entities: Entity[];
}): boolean => {
  return !entities.some((e) => {
    const { apiKey, parentPath } = splitEntityId(e.id);
    const { apiKey: importApiKey, parentPath: importParentPath } =
      splitEntityId(entity.id);

    return (
      apiKey === importApiKey &&
      parentPath === importParentPath &&
      entity.name === e.name
    );
  });
};

export const doesHaveDotsInTheEnd = (name: string) => name.trim().endsWith('.');

export const isEntityNameInvalid = (name: string) =>
  doesHaveDotsInTheEnd(name) || notAllowedSymbolsRegex.test(name);

export const hasInvalidNameInPath = (path: string) =>
  path.split('/').some((part) => isEntityNameInvalid(part));

export const isEntityNameOrPathInvalid = (entity: Entity) =>
  isEntityNameInvalid(entity.name) || hasInvalidNameInPath(entity.folderId);

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

export const trimEndDots = (str: string) => trimEnd(str, '. \t\r\n');

export const prepareEntityName = (
  name: string,
  options?: Partial<PrepareNameOptions>,
) => {
  const clearName = options?.forRenaming
    ? name
        .replace(
          notAllowedSymbolsRegex,
          options?.replaceWithSpacesForRenaming ? ' ' : '',
        )
        .trim()
    : name
        .replace(/\r\n|\r/gm, '\n')
        .split('\n')
        .map((s) => s.replace(notAllowedSymbolsRegex, ' ').trim())
        .filter(Boolean)[0] ?? '';
  const result =
    clearName.length > MAX_ENTITY_LENGTH
      ? substring(clearName, 0, MAX_ENTITY_LENGTH)
      : clearName;

  const additionalCuttedResult =
    result.length > MAX_ENTITY_LENGTH
      ? result.substring(0, MAX_ENTITY_LENGTH)
      : result;

  return !options?.forRenaming || options?.trimEndDotsRequired
    ? trimEndDots(additionalCuttedResult)
    : additionalCuttedResult.trim();
};

export const isSearchTermMatched = (entity: ShareEntity, searchTerm?: string) =>
  !searchTerm || doesEntityContainSearchTerm(entity, searchTerm);

export const isSearchFilterMatched = (
  entity: ShareEntity,
  filters: EntityFilters,
) => filters.searchFilter?.(entity) ?? true;

export const isSectionFilterMatched = (
  entity: ShareEntity,
  filters: EntityFilters,
  ignoreSectionFilter?: boolean,
) => ignoreSectionFilter || (filters.sectionFilter?.(entity) ?? true);

export const isVersionFilterMatched = (
  entity: ShareEntity,
  filters: EntityFilters,
  versionGroups: PublicVersionGroups,
  ignoreVersionFilter?: boolean,
) => {
  if (ignoreVersionFilter) return true;

  const version = entity.publicationInfo?.version;
  if (!version || !filters.versionFilter) return true;

  const currentVersionGroup =
    versionGroups[getPublicItemIdWithoutVersion(version, entity.id)];
  return currentVersionGroup
    ? filters.versionFilter(entity, currentVersionGroup.selectedVersion.version)
    : true;
};

export const isVersionValid = (version: string | undefined) => {
  if (!version) {
    return false;
  }

  const versionParts = version.split('.');

  return (
    versionParts.length === 3 &&
    versionParts.every((part) => /^\d+$/.test(part))
  );
};

export const findLatestVersion = (versions: string[]) => {
  const filteredVersions = versions.filter((v) => v !== NA_VERSION);

  if (!filteredVersions.length) {
    return NA_VERSION;
  }

  const sortedVersions = orderBy(
    filteredVersions,
    [(version) => version.split('.').map(Number)],
    ['asc'],
  );

  return sortedVersions.pop();
};

export const sortAllVersions = (
  versions: NonNullable<PublicVersionGroups[string]>['allVersions'],
) =>
  orderBy(
    versions,
    ({ version }) => {
      if (version === 'N/A') {
        return [-1, -1, -1];
      }

      return version.split('.').map(Number);
    },
    ['desc', 'desc', 'desc'],
  );

export const groupAllVersions = (
  versions: NonNullable<PublicVersionGroups[string]>['allVersions'],
) =>
  Object.values(
    groupBy(
      versions.map((group) => group),
      (group) => group.version.match(/^\d+\.\d+/),
    ),
  ).flatMap((group) => {
    const latestVersion = findLatestVersion(
      group.map(({ version }) => version),
    );
    const latestVersionItemId = group.find(
      (item) => item.version === latestVersion,
    )?.id;

    return latestVersion && latestVersionItemId
      ? [{ version: latestVersion, id: latestVersionItemId }]
      : [];
  });
