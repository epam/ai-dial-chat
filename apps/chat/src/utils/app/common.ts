import type { MouseEvent } from 'react';

import {
  constructPath,
  notAllowedSpacesRegex,
  notAllowedSymbolsRegex,
} from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import {
  getPublicItemIdWithoutVersion,
  pathKeySeparator,
} from '@/src/utils/server/api';

import { Conversation, PrepareNameOptions } from '@/src/types/chat';
import {
  PublicVersionGroups,
  PublicVersionOption,
} from '@/src/types/publication';
import { EntityFilters } from '@/src/types/search';

import {
  MAX_ENTITY_LENGTH,
  MIN_ENTITY_LENGTH,
} from '@/src/constants/default-ui-settings';
import { NA_VERSION, PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import {
  Entity,
  EntityDates,
  ShareEntity,
  ShareInterface,
} from '@epam/ai-dial-shared';
import countBy from 'lodash-es/countBy';
import groupBy from 'lodash-es/groupBy';
import isEqual from 'lodash-es/isEqual';
import keyBy from 'lodash-es/keyBy';
import merge from 'lodash-es/merge';
import trimEnd from 'lodash-es/trimEnd';
import values from 'lodash-es/values';
import { nanoid } from 'nanoid';
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

export const isEntityNameInvalid = (name: string, checkDotsInTheEnd = true) =>
  notAllowedSymbolsRegex.test(name) ||
  (checkDotsInTheEnd && doesHaveDotsInTheEnd(name));

export const isEntityNameValid = (name: string, checkDotsInTheEnd = true) => {
  const trimmedName = name.trim();

  return (
    !isEntityNameInvalid(trimmedName, checkDotsInTheEnd) &&
    trimmedName.length <= MAX_ENTITY_LENGTH &&
    trimmedName.length >= MIN_ENTITY_LENGTH
  );
};

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

export const trimEndDots = (str: string) => trimEnd(str, '. \t\r\n');

export const replaceSpacesFromString = (valueToClean: string | undefined) =>
  valueToClean?.replace(notAllowedSpacesRegex, ' ') ?? '';

export const prepareEntityName = (
  name: string,
  options?: Partial<PrepareNameOptions>,
) => {
  const replacementChar = options?.replaceWithSpacesForRenaming ? '_' : '';

  const clearName = options?.forRenaming
    ? name.replace(notAllowedSymbolsRegex, replacementChar).trim()
    : (name
        .replace(/\r\n|\r/gm, '\n')
        .split('\n')
        .map((s) => s.replace(notAllowedSymbolsRegex, '_').trim())
        .filter(Boolean)[0] ?? '');

  const maxEntityLength = options?.maxNameLength ?? MAX_ENTITY_LENGTH;
  const result =
    clearName.length > maxEntityLength
      ? substring(clearName, 0, maxEntityLength)
      : clearName;

  const additionalCuttedResult =
    result.length > maxEntityLength
      ? result.substring(0, maxEntityLength)
      : result;

  return !options?.forRenaming || options?.trimEndDotsRequired
    ? trimEndDots(additionalCuttedResult)
    : additionalCuttedResult.trim();
};

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

export const isVersionPartSizeValid = (version: string | undefined) => {
  if (!version) {
    return false;
  }

  return version.split('.').every((part) => part.length <= 5);
};

export const isVersionExists = (
  versionToTest: string,
  entityId: string,
  publicVersionGroups: PublicVersionGroups,
  newName: string,
) => {
  const { apiKey, parentPath, name: oldName } = splitEntityId(entityId);
  const modelName = oldName.split(pathKeySeparator)[0];
  const newEntityId = constructPath(
    apiKey,
    PUBLIC_URL_PREFIX,
    parentPath,
    `${modelName}${pathKeySeparator}${newName}`,
  );
  const allVersions = publicVersionGroups[newEntityId]?.allVersions;

  return allVersions?.some(
    (versionGroup) => versionToTest === versionGroup.version,
  );
};

function compareVersions(version1: string, version2: string) {
  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export const findLatestVersion = (versions: string[]) => {
  const filteredVersions = versions.filter((v) => v !== NA_VERSION);

  if (!filteredVersions.length) {
    return NA_VERSION;
  }

  return versions.reduce((max, current) => {
    return compareVersions(current, max) > 0 ? current : max;
  });
};

export const sortItemsVersions = <T extends { version?: string | undefined }>(
  items: T[],
): T[] =>
  items.sort((a, b) => {
    const versionA = a.version;
    const versionB = b.version;

    if (!versionA || versionA === NA_VERSION) return 1;
    if (!versionB || versionB === NA_VERSION) return -1;

    return compareVersions(versionB, versionA);
  });

export const groupAllVersions = (versions: PublicVersionOption[]) =>
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

export const fakeCallback = () => null;

export const castToString = (value: unknown): string => value as string;

export const extractNameFromEmail = (author: string | undefined) => {
  if (typeof author !== 'string') return; // we expecting only string
  const regEx = /^[^@]+@[^@]+.[^@]+$/; // regex to test is author in an email format
  return regEx.test(author) ? author.split('@')[0] : author;
};

export const formatDate = (rawDate: number | string | Date): string => {
  return new Date(rawDate).toLocaleDateString();
};

export const parseCommaSeparatedList = (
  str: string | undefined,
  defaultValue: string[] = [],
): string[] => str?.split(',').map((str) => str.trim()) ?? defaultValue;

export const dispatchMouseLeaveEvent = (e: MouseEvent) => {
  const mouseLeaveEvent = new MouseEvent('mouseleave', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  e.currentTarget.dispatchEvent(mouseLeaveEvent);
};

export const arraysHaveSameElements = <T>(
  arr1: T[] | undefined,
  arr2: T[] | undefined,
) => {
  const count1 = countBy(arr1);
  const count2 = countBy(arr2);

  return isEqual(count1, count2);
};

export const getDefaultEntityProps = (): ShareInterface & EntityDates => ({
  isShared: false,
  publishedWithMe: false,
  sharedWithMe: false,
  updatedAt: Date.now(),
  createdAt: Date.now(),
});

export const getDefaultConversationProps = (): ShareInterface &
  EntityDates &
  Pick<Conversation, 'reference'> => ({
  ...getDefaultEntityProps(),
  reference: nanoid(),
});

export const replaceStringRange = (
  currentString: string,
  value: string,
  start: number,
  end: number,
) => {
  return currentString.slice(0, start) + value + currentString.slice(end);
};

export const getLastPathSegment = (path: string) => path.split('/').pop() ?? '';
