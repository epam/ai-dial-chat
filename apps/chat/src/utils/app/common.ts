import type { MouseEvent } from 'react';

import {
  constructPath,
  notAllowedSpacesRegex,
  notAllowedSymbolsRegex,
} from '@/src/utils/app/file';
import {
  getResourceMaxIdBytes,
  getResourceMaxSegmentBytes,
} from '@/src/utils/app/resource-limits';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import {
  getPublicItemIdWithoutVersion,
  pathKeySeparator,
} from '@/src/utils/server/api';

import { Conversation, PrepareNameOptions } from '@/src/types/chat';
import { ApiKeys } from '@/src/types/common';
import {
  PublicVersionGroups,
  PublicVersionOption,
} from '@/src/types/publication';
import { EntityFilters } from '@/src/types/search';

import {
  MAX_ENTITY_NAME_NUMERATION,
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
export const doesHaveDotsInTheStart = (name: string) =>
  name.trim().startsWith('.');

export const isEntityNameInvalid = (name: string, checkDotsInTheEnd = true) =>
  notAllowedSymbolsRegex.test(name) ||
  (checkDotsInTheEnd && doesHaveDotsInTheEnd(name));

export const isEntityNameValid = (
  name: string,
  options?: {
    checkDotsInTheEnd?: boolean;
    minLength?: number;
    maxLength?: number;
    maxBytes?: number;
  },
) => {
  const {
    checkDotsInTheEnd = true,
    minLength = MIN_ENTITY_LENGTH,
    maxLength,
    maxBytes,
  } = options ?? {};
  const trimmedName = name.trim();
  const resolvedMaxBytes =
    maxBytes ?? maxLength ?? getResourceMaxSegmentBytes();

  return (
    !isEntityNameInvalid(trimmedName, checkDotsInTheEnd) &&
    getUtf8BytesLength(trimmedName) <= resolvedMaxBytes &&
    trimmedName.length >= minLength
  );
};

export const isEntityNameValidWithDecode = (
  name: string,
  options?: {
    checkDotsInTheEnd?: boolean;
    minLength?: number;
    maxLength?: number;
    maxBytes?: number;
  },
) => {
  const decoded = decodeURIComponent(name);

  return isEntityNameValid(
    decoded.length !== name.length ? decoded : name,
    options,
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

  const maxEntityNameBytes =
    options?.maxNameLength ?? getResourceMaxSegmentBytes();
  const additionalCuttedResult = truncateToUtf8Bytes(
    clearName,
    maxEntityNameBytes,
  );

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

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string | undefined): boolean =>
  !!value && uuidRegex.test(value);

export const isVersionExists = (
  versionToTest: string,
  entityId: string,
  publicVersionGroups: PublicVersionGroups,
  newName: string,
  rootFolder = PUBLIC_URL_PREFIX,
) => {
  const { apiKey, parentPath, name: oldName } = splitEntityId(entityId);
  const modelName = oldName.split(pathKeySeparator)[0];

  let newApiKey: string;
  if (apiKey === ApiKeys.Conversations) {
    newApiKey = `${modelName}${pathKeySeparator}${newName}`;
  } else {
    newApiKey = newName;
  }

  const newEntityId = constructPath(apiKey, rootFolder, parentPath, newApiKey);
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
  if (typeof author !== 'string') return;

  // Extract name only from standard email-like strings (e.g. name@domain.tld).
  // Keeps malformed/special-character strings unchanged.
  const match = author.match(
    /^([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})$/,
  );

  return match ? match[1] : author;
};

export const formatDate = (rawDate: number | string | Date): string => {
  return new Date(rawDate).toLocaleDateString();
};

export const parseCommaSeparatedList = (
  str: string | undefined,
  defaultValue: string[] = [],
): string[] => {
  const guid = nanoid();
  return (
    str
      ?.replaceAll('\\,', guid)
      .split(',')
      .map((str) => str.replaceAll(guid, ',').trim()) ?? defaultValue
  );
};

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

export const getTranscriptTextToInsert = (
  beforeCursor: string,
  transcript: string,
) => {
  const trimmedTranscript = transcript.trim();

  if (!trimmedTranscript) {
    return '';
  }

  const needsLeadingSpace =
    beforeCursor.trim().length > 0 && !beforeCursor.endsWith(' ');

  return needsLeadingSpace ? ` ${trimmedTranscript}` : trimmedTranscript;
};

export const buildContentWithTranscriptAtSelection = (
  input: string,
  transcript: string,
  selection: { start: number; end: number },
) => {
  const clampedStart = Math.max(0, Math.min(selection.start, input.length));
  const clampedEnd = Math.max(
    clampedStart,
    Math.min(selection.end, input.length),
  );
  const beforeCursor = input.substring(0, clampedStart);
  const textToInsert = getTranscriptTextToInsert(beforeCursor, transcript);

  return replaceStringRange(input, textToInsert, clampedStart, clampedEnd);
};

export const getLastPathSegment = (path: string) => path.split('/').pop() ?? '';

export const addTrailingSlashIfAbsent = (id: string) =>
  id.endsWith('/') ? id : `${id}/`;

export const getEntityBaseId = (id: string): string => {
  const lastColonIndex = id.lastIndexOf(':');
  if (lastColonIndex === -1) {
    return id;
  }
  const protocolSeparatorIndex = id.indexOf('://');
  if (
    protocolSeparatorIndex !== -1 &&
    lastColonIndex < protocolSeparatorIndex
  ) {
    return id;
  }
  return id.substring(0, lastColonIndex);
};

export const getSafeRedirectUrl = (url: string) => {
  try {
    const safeUrl = new URL(url, window.location.origin);
    if (window.location.origin === safeUrl.origin) return safeUrl;
  } catch {
    console.error('Invalid url');
  }
  return undefined;
};

export type EntityStorageLimits = {
  maxIdBytes?: number;
  maxSegmentBytes?: number;
};

export const getResourceStorageLimits = (): EntityStorageLimits => ({
  maxIdBytes: getResourceMaxIdBytes(),
  maxSegmentBytes: getResourceMaxSegmentBytes(),
});

const _textEncoder = new TextEncoder();

export const getUtf8BytesLength = (value: string): number =>
  _textEncoder.encode(value).length;

export const truncateToUtf8Bytes = (
  value: string,
  maxBytes: number,
): string => {
  if (maxBytes <= 0) return '';

  let currentBytes = 0;
  let result = '';

  for (const char of value) {
    const charBytes = getUtf8BytesLength(char);
    if (currentBytes + charBytes > maxBytes) break;
    result += char;
    currentBytes += charBytes;
  }

  return result;
};

export const getAvailableEntityNameBytes = (
  buildFullId: (placeholderName: string) => string,
  buildLastSegment: (placeholderName: string) => string,
  limits: EntityStorageLimits,
): number | undefined => {
  const placeholder = 'a';
  const placeholderBytes = getUtf8BytesLength(placeholder);

  const byIdLimit = limits.maxIdBytes
    ? Math.max(
        limits.maxIdBytes -
          getUtf8BytesLength(buildFullId(placeholder)) +
          placeholderBytes,
        0,
      )
    : undefined;

  const bySegmentLimit = limits.maxSegmentBytes
    ? Math.max(
        limits.maxSegmentBytes -
          getUtf8BytesLength(buildLastSegment(placeholder)) +
          placeholderBytes,
        0,
      )
    : undefined;

  if (byIdLimit === undefined && bySegmentLimit === undefined) return undefined;
  if (byIdLimit === undefined) return bySegmentLimit;
  if (bySegmentLimit === undefined) return byIdLimit;
  return Math.min(byIdLimit, bySegmentLimit);
};

export const buildByteAwareFitBaseName =
  (availableNameBytes: number | undefined) =>
  (baseName: string, suffix: string): string => {
    if (availableNameBytes === undefined) {
      return baseName;
    }

    const allowedNameBytes = Math.max(
      availableNameBytes - getUtf8BytesLength(suffix),
      0,
    );

    return prepareEntityName(truncateToUtf8Bytes(baseName, allowedNameBytes));
  };

export const getStorageSafeUniqueName = (params: {
  desiredName?: string;
  defaultName: string;
  existingNames: string[];
  fitBaseName: (baseName: string, suffix: string) => string;
  maxNumeration?: number;
}): string | undefined => {
  const {
    desiredName,
    defaultName,
    existingNames,
    fitBaseName,
    maxNumeration = MAX_ENTITY_NAME_NUMERATION,
  } = params;

  const existingNamesSet = new Set(existingNames);
  const resolvedBaseName =
    prepareEntityName(desiredName ?? '') || prepareEntityName(defaultName);

  // Rename/copy tries the base name first; new entities continue from max "{baseName} N".
  let startIndex: number;
  if (desiredName !== undefined) {
    startIndex = 0;
  } else {
    const prefix = `${resolvedBaseName} `;
    let maxSuffix = 0;
    for (const name of existingNames) {
      if (name.startsWith(prefix)) {
        const rest = name.slice(prefix.length);
        if (/^\d+$/.test(rest)) {
          const n = parseInt(rest, 10);
          if (n > maxSuffix) maxSuffix = n;
        }
      }
    }
    startIndex = maxSuffix + 1;
  }

  for (let index = startIndex; index <= maxNumeration; index++) {
    const suffix = index === 0 ? '' : ` ${index}`;
    const fittedBaseName = fitBaseName(resolvedBaseName, suffix);
    const candidate = `${fittedBaseName}${suffix}`.trim();

    if (candidate && !existingNamesSet.has(candidate)) {
      return candidate;
    }
  }

  return undefined;
};
