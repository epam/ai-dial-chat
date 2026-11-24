import {
  ResourceDependencyAccess,
  type ApplicationResourceDependencyDto,
} from '@epam/ai-dial-chat-api-client';
import { AccessLevel } from '@epam/ai-dial-chat-shared';
import type {
  ApplicationAccessEntry,
  ApplicationAccessPartition,
  ApplicationAccessPreservedEntry,
} from './models';
import { ApplicationAccessContentType } from './types';

const CURRENT_USER_PLACEHOLDER = '{current-user}';

const LINK_ID_PREFIX = 'access-';

/** Content types in the order the editor lists them. */
export const APPLICATION_ACCESS_CONTENT_TYPES: readonly ApplicationAccessContentType[] =
  [
    ApplicationAccessContentType.Files,
    ApplicationAccessContentType.Projects,
    ApplicationAccessContentType.Skills,
    ApplicationAccessContentType.Prompts,
    ApplicationAccessContentType.Conversations,
    ApplicationAccessContentType.Applications,
    ApplicationAccessContentType.Toolsets,
  ];

/** Rights each content type allows. DIAL Core refuses `write` on applications and toolsets. */
export const APPLICATION_ACCESS_ALLOWED_LEVELS: Readonly<
  Record<ApplicationAccessContentType, readonly AccessLevel[]>
> = {
  [ApplicationAccessContentType.Files]: [
    AccessLevel.Read,
    AccessLevel.ReadWrite,
  ],
  [ApplicationAccessContentType.Projects]: [
    AccessLevel.Read,
    AccessLevel.ReadWrite,
  ],
  [ApplicationAccessContentType.Skills]: [
    AccessLevel.Read,
    AccessLevel.ReadWrite,
  ],
  [ApplicationAccessContentType.Prompts]: [
    AccessLevel.Read,
    AccessLevel.ReadWrite,
  ],
  [ApplicationAccessContentType.Conversations]: [
    AccessLevel.Read,
    AccessLevel.ReadWrite,
  ],
  [ApplicationAccessContentType.Applications]: [AccessLevel.Read],
  [ApplicationAccessContentType.Toolsets]: [AccessLevel.Read],
};

/**
 * Lists the rights a content type allows.
 * @param contentType - the content type to look up
 */
export const getAllowedAccessLevels = (
  contentType: ApplicationAccessContentType,
): readonly AccessLevel[] => APPLICATION_ACCESS_ALLOWED_LEVELS[contentType];

/**
 * Returns the level when the content type allows it, otherwise `Read`.
 * @param contentType - the content type the level applies to
 * @param level - the requested level
 */
export const clampAccessLevel = (
  contentType: ApplicationAccessContentType,
  level: AccessLevel,
): AccessLevel =>
  getAllowedAccessLevels(contentType).includes(level)
    ? level
    : AccessLevel.Read;

/**
 * Switches an entry to another content type, resetting its level to `Read`
 * when the new type does not allow the current one.
 * @param entry - the entry being edited
 * @param contentType - the content type chosen for it
 */
export const changeApplicationAccessContentType = (
  entry: ApplicationAccessEntry,
  contentType: ApplicationAccessContentType,
): ApplicationAccessEntry => ({
  contentType,
  accessLevel: clampAccessLevel(contentType, entry.accessLevel),
});

/**
 * Builds the dependency target URL of a content type in the caller's own bucket.
 * @param contentType - the content type to address
 */
export const buildApplicationAccessUrl = (
  contentType: ApplicationAccessContentType,
): string => `${contentType}/${CURRENT_USER_PLACEHOLDER}/`;

/**
 * Maps a level to the rights a dependency entry carries.
 * @param level - the level to map
 */
export const toResourceDependencyAccess = (
  level: AccessLevel,
): ResourceDependencyAccess[] =>
  level === AccessLevel.ReadWrite
    ? [ResourceDependencyAccess.Read, ResourceDependencyAccess.Write]
    : [ResourceDependencyAccess.Read];

const accessSetKey = (access: readonly ResourceDependencyAccess[]): string =>
  [...new Set(access)].sort().join(',');

const READ_KEY = accessSetKey([ResourceDependencyAccess.Read]);
const READ_WRITE_KEY = accessSetKey([
  ResourceDependencyAccess.Read,
  ResourceDependencyAccess.Write,
]);

const contentTypeOfUrl = (
  url: string,
  contentTypes: readonly ApplicationAccessContentType[],
): ApplicationAccessContentType | undefined =>
  contentTypes.find((type) => url === buildApplicationAccessUrl(type));

const levelOfAccess = (
  access: readonly ResourceDependencyAccess[],
): AccessLevel | undefined => {
  const key = accessSetKey(access);
  if (key === READ_KEY) return AccessLevel.Read;
  if (key === READ_WRITE_KEY) return AccessLevel.ReadWrite;
  return undefined;
};

/**
 * Splits a stored list into editable entries and preserved ones. An entry is
 * editable only when its URL is exactly `<type>/{current-user}/` for an
 * offered type, it is not required, its rights are Read or Read and Write
 * (compared as a set) and allowed for that type, and no earlier entry already
 * claimed the type. Everything else is preserved.
 * @param storedList - the stored dependency list
 * @param contentTypes - the content types the host offers
 */
export const partitionResourceDependencies = (
  storedList: readonly ApplicationResourceDependencyDto[],
  contentTypes: readonly ApplicationAccessContentType[] = APPLICATION_ACCESS_CONTENT_TYPES,
): ApplicationAccessPartition => {
  const entries: ApplicationAccessEntry[] = [];
  const preserved: ApplicationAccessPreservedEntry[] = [];
  const claimed = new Set<ApplicationAccessContentType>();

  storedList.forEach((stored, index) => {
    const contentType = contentTypeOfUrl(stored.target.url, contentTypes);
    const accessLevel = levelOfAccess(stored.access);
    const isEditable =
      contentType != null &&
      accessLevel != null &&
      stored.required !== true &&
      !claimed.has(contentType) &&
      getAllowedAccessLevels(contentType).includes(accessLevel);

    if (isEditable) {
      claimed.add(contentType);
      entries.push({ contentType, accessLevel });
      return;
    }
    preserved.push({
      index,
      linkId: stored.linkId,
      url: stored.target.url,
      access: [...stored.access],
      level: accessLevel,
      isRequired: stored.required === true,
    });
  });

  return { entries, preserved };
};

/**
 * Picks the `link_id` for a new entry: `access-<type>`, with a numeric suffix
 * while another entry already uses it.
 * @param contentType - the content type of the new entry
 * @param usedLinkIds - ids already present in the list
 */
export const buildApplicationAccessLinkId = (
  contentType: ApplicationAccessContentType,
  usedLinkIds: ReadonlySet<string>,
): string => {
  const base = `${LINK_ID_PREFIX}${contentType}`;
  if (!usedLinkIds.has(base)) return base;
  let suffix = 2;
  while (usedLinkIds.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

const toDependency = (
  linkId: string,
  entry: ApplicationAccessEntry,
): ApplicationResourceDependencyDto => ({
  linkId,
  target: { url: buildApplicationAccessUrl(entry.contentType) },
  access: toResourceDependencyAccess(
    clampAccessLevel(entry.contentType, entry.accessLevel),
  ),
  required: false,
});

/**
 * Builds the full list to send. Every stored position keeps its place: a
 * preserved entry is returned untouched, an edited entry is replaced in place
 * keeping its stored `link_id`, a removed entry is dropped, and an entry for a
 * type not stored yet is appended last. The first entry per type wins and a
 * level a type does not allow becomes `Read`.
 * @param storedList - the stored dependency list the draft started from
 * @param entries - the configured entries of the draft
 * @param contentTypes - the content types the host offers
 */
export const mergeApplicationAccess = (
  storedList: readonly ApplicationResourceDependencyDto[],
  entries: readonly ApplicationAccessEntry[],
  contentTypes: readonly ApplicationAccessContentType[] = APPLICATION_ACCESS_CONTENT_TYPES,
): ApplicationResourceDependencyDto[] => {
  const draftByType = new Map<
    ApplicationAccessContentType,
    ApplicationAccessEntry
  >();
  for (const entry of entries) {
    if (!draftByType.has(entry.contentType)) {
      draftByType.set(entry.contentType, entry);
    }
  }

  const { preserved } = partitionResourceDependencies(storedList, contentTypes);
  const preservedIndexes = new Set(preserved.map((item) => item.index));
  const merged: ApplicationResourceDependencyDto[] = [];
  const placed = new Set<ApplicationAccessContentType>();

  storedList.forEach((stored, index) => {
    if (preservedIndexes.has(index)) {
      merged.push(stored);
      return;
    }
    const contentType = contentTypeOfUrl(stored.target.url, contentTypes);
    const draft =
      contentType == null ? undefined : draftByType.get(contentType);
    if (contentType == null || draft == null) return;
    placed.add(contentType);
    merged.push(toDependency(stored.linkId, draft));
  });

  const usedLinkIds = new Set(merged.map((item) => item.linkId));
  for (const [contentType, draft] of draftByType) {
    if (placed.has(contentType)) continue;
    const linkId = buildApplicationAccessLinkId(contentType, usedLinkIds);
    usedLinkIds.add(linkId);
    merged.push(toDependency(linkId, draft));
  }

  return merged;
};

const normalizeDependency = (
  dependency: ApplicationResourceDependencyDto,
): string =>
  JSON.stringify([
    dependency.linkId,
    dependency.target.url,
    accessSetKey(dependency.access),
    dependency.required === true,
  ]);

/**
 * Compares two lists order-sensitively, with rights as a set, `required`
 * defaulting to false and the URL byte-exact.
 * @param left - the first list
 * @param right - the second list
 */
export const areResourceDependenciesEqual = (
  left: readonly ApplicationResourceDependencyDto[],
  right: readonly ApplicationResourceDependencyDto[],
): boolean =>
  left.length === right.length &&
  left.every(
    (item, index) =>
      normalizeDependency(item) === normalizeDependency(right[index]),
  );
