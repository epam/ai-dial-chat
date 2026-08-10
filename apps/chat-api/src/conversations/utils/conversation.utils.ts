import { StringUtils } from '../../common/utils/string-utils';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  COMPOUND_TOKEN_PREFIX,
  PUBLIC_BUCKET,
} from '../constants/conversation.constants';
import type { CompoundNextToken } from '../types/conversation.types';

/*
 * Strips characters unsafe in DIAL Core resource names: path separators (/ %),
 * null bytes, and Unicode bidi codepoints that can spoof filenames (CWE-116).
 */
const notAllowedSymbolsRegex =
  /[:;,=/{}%&"\0\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;
const trailingDotsRegex = /\.+$/g;
const MAX_ENTITY_BYTES = 255;
const CONVERSATION_NAME_SEPARATOR = '__';
const UUID_PART_LENGTHS = [8, 4, 4, 4, 12] as const;
const VERSION_METADATA_SEPARATOR_REGEX = /[-+]/;
const HEX_REGEX = /^[\da-f]+$/i;
const VERSION_NUMBER_PART_REGEX = /^\d+$/;
/*
 * DIAL Core only versions the deployment ID itself for custom applications
 * (`applications/{bucket}/{name}__{version}`) — plain model deployments
 * never have a version suffix. The functions below take a bare filename
 * with no path context, so callers MUST tell them whether the filename sits
 * under an `applications/` folder; otherwise a purely-numeric conversation
 * TITLE (e.g. "18") is indistinguishable from a version suffix like "1.0.0"
 * and gets misparsed as part of the deployment ID (breaking title/icon
 * resolution for that conversation).
 */
const APPLICATIONS_PATH_SEGMENT = 'applications';

const isDeploymentVersionSuffix = (value?: string): boolean => {
  if (!value) return false;

  const numericVersion = value.split(VERSION_METADATA_SEPARATOR_REGEX)[0];
  return numericVersion
    .split('.')
    .every((part) => VERSION_NUMBER_PART_REGEX.test(part));
};

export const isUuid = (value: string): boolean => {
  const parts = value.split('-');
  return (
    parts.length === UUID_PART_LENGTHS.length &&
    parts.every(
      (part, index) =>
        part.length === UUID_PART_LENGTHS[index] && HEX_REGEX.test(part),
    )
  );
};

/**
 * True when the folder path preceding a conversation's filename marks a
 * custom-application deployment (`applications/{bucket}/...`), the only
 * DIAL Core resource type whose id carries a `{name}__{version}` suffix.
 */
export const isApplicationDeploymentPath = (
  folderPath: string | undefined,
): boolean => (folderPath ?? '').split('/')[0] === APPLICATIONS_PATH_SEGMENT;

const getDeploymentNameParts = (
  filenameParts: string[],
  isApplicationDeployment: boolean,
): string[] => {
  const [name = '', versionSuffix] = filenameParts;
  return isApplicationDeployment && isDeploymentVersionSuffix(versionSuffix)
    ? [name, versionSuffix]
    : [name];
};

/**
 * Returns the trailing legacy/run UUID segment of a `{deploymentId}__{title}__{uuid}`
 * conversation filename, or undefined when the filename has no such suffix.
 */
const getFilenameLegacySuffix = (
  filename: string,
  isApplicationDeployment: boolean,
): string | undefined => {
  const parts = filename.split(CONVERSATION_NAME_SEPARATOR);
  if (parts.length < 2) return undefined;

  const deploymentNameParts = getDeploymentNameParts(
    parts,
    isApplicationDeployment,
  );
  const hasVersionedDeployment = deploymentNameParts.length > 1;
  const hasLegacySuffix = hasVersionedDeployment
    ? isUuid(parts[parts.length - 1])
    : parts.length >= 3;

  return hasLegacySuffix ? parts[parts.length - 1] : undefined;
};

/**
 * Extracts the DIAL Scheduler run id from a scheduled-task conversation
 * filename (`{deploymentId}__{title}__{runId}`). Returns undefined unless
 * the trailing suffix is present and is itself a valid UUID.
 */
export const getRunIdFromFilename = (
  filename: string,
  isApplicationDeployment: boolean,
): string | undefined => {
  const suffix = getFilenameLegacySuffix(filename, isApplicationDeployment);
  return suffix != null && isUuid(suffix) ? suffix : undefined;
};

export const prepareEntityName = (prompt?: string): string => {
  const clearName =
    prompt
      ?.replace(/\r\n|\r/gm, '\n')
      .split('\n')
      .map((s) => s.replace(notAllowedSymbolsRegex, ' ').trim())
      .filter(Boolean)[0] ?? '';

  return StringUtils.truncateToUtf8Bytes(clearName, MAX_ENTITY_BYTES)
    .replace(trailingDotsRegex, '')
    .trimEnd();
};

export const getConversationName = (
  defaultName: string,
  prompt?: string,
): string => prepareEntityName(prompt) || prepareEntityName(defaultName);

/**
 * Extracts the human-readable title from a DIAL Core conversation filename.
 * Supports versioned application deployment IDs and the legacy UUID suffix.
 * The title may itself contain `__`, so we take all segments after the first
 * deployment separator (and before a trailing UUID when present).
 *
 * `isApplicationDeployment` must reflect whether `name`'s folder path is
 * `applications/...` (see `isApplicationDeploymentPath`) — this function
 * only sees the bare filename, so it cannot determine that itself.
 */
export const getConversationTitleFromName = (
  name: string,
  isApplicationDeployment: boolean,
): string => {
  const parts = name.split(CONVERSATION_NAME_SEPARATOR);
  if (parts.length < 2) return name;

  const deploymentNameParts = getDeploymentNameParts(
    parts,
    isApplicationDeployment,
  );
  const hasVersionedDeployment = deploymentNameParts.length > 1;
  const hasLegacySuffix = hasVersionedDeployment
    ? isUuid(parts[parts.length - 1])
    : parts.length >= 3;
  const titleEndIndex = hasLegacySuffix ? parts.length - 1 : parts.length;

  return parts
    .slice(deploymentNameParts.length, titleEndIndex)
    .join(CONVERSATION_NAME_SEPARATOR);
};

/**
 * Replaces the title segment inside a single conversation filename, preserving
 * a versioned application deployment ID prefix and a legacy UUID suffix.
 * Operates on a bare filename (no `/` path separators), so it is safe to use
 * on a decoded filename whose deployment name contains a literal slash.
 *
 * See `getConversationTitleFromName` for why `isApplicationDeployment` must
 * be supplied by the caller.
 */
export const buildRenamedFilename = (
  filename: string,
  sanitisedTitle: string,
  isApplicationDeployment: boolean,
): string => {
  const parts = filename.split(CONVERSATION_NAME_SEPARATOR);
  if (parts.length < 2) return sanitisedTitle;

  const deploymentNameParts = getDeploymentNameParts(
    parts,
    isApplicationDeployment,
  );
  const hasVersionedDeployment = deploymentNameParts.length > 1;
  const hasLegacySuffix = hasVersionedDeployment
    ? isUuid(parts[parts.length - 1])
    : parts.length >= 3;
  const legacySuffix = hasLegacySuffix ? parts[parts.length - 1] : undefined;

  return [
    ...deploymentNameParts,
    sanitisedTitle,
    ...(legacySuffix ? [legacySuffix] : []),
  ].join(CONVERSATION_NAME_SEPARATOR);
};

/**
 * Returns the deployment key (e.g. `"gpt-4o"` or `"app__1.0.0"`) from a
 * bare conversation filename. Used when building a clean destination path
 * for duplicate (where the legacy UUID suffix must NOT be carried over).
 *
 * See `getConversationTitleFromName` for why `isApplicationDeployment` must
 * be supplied by the caller.
 */
export const getDeploymentKey = (
  filename: string,
  isApplicationDeployment: boolean,
): string => {
  const parts = filename.split(CONVERSATION_NAME_SEPARATOR);
  return getDeploymentNameParts(parts, isApplicationDeployment).join(
    CONVERSATION_NAME_SEPARATOR,
  );
};

/**
 * Builds the new conversation path by replacing the title segment in the filename.
 * Preserves versioned application deployment IDs and legacy UUID suffixes.
 * Unlike `buildRenamedFilename`, this operates on the full path, so it can
 * derive `isApplicationDeployment` itself from the folder segments.
 */
export const buildRenamedConversationPath = (
  conversationPath: string,
  sanitisedTitle: string,
): string => {
  const segments = conversationPath.split('/');
  const filename = segments[segments.length - 1];
  const isApplicationDeployment = isApplicationDeploymentPath(
    segments.slice(0, -1).join('/'),
  );
  const renamedFilename = buildRenamedFilename(
    filename,
    sanitisedTitle,
    isApplicationDeployment,
  );

  return segments.length > 1
    ? [...segments.slice(0, -1), renamedFilename].join('/')
    : renamedFilename;
};

/** Builds the full DIAL Core resource URL for a conversation: `conversations/<bucket>/<path>` */
export const buildConversationUrl = (
  bucket: string,
  conversationPath: string,
): string => `conversations/${bucket}/${conversationPath}`;

export const encodeCompoundToken = (
  userToken?: string,
  publicToken?: string,
): string | undefined => {
  if (!userToken && !publicToken) return undefined;
  const payload: CompoundNextToken = {};
  if (userToken) payload.u = userToken;
  if (publicToken) payload.p = publicToken;
  return (
    COMPOUND_TOKEN_PREFIX +
    Buffer.from(JSON.stringify(payload)).toString('base64url')
  );
};

export const decodeNextToken = (token?: string): CompoundNextToken => {
  if (!token) return {};
  if (token.startsWith(COMPOUND_TOKEN_PREFIX)) {
    try {
      return JSON.parse(
        Buffer.from(
          token.slice(COMPOUND_TOKEN_PREFIX.length),
          'base64url',
        ).toString('utf-8'),
      ) as CompoundNextToken;
    } catch {
      return {};
    }
  }
  return { u: token };
};

/**
 * Resolves a possibly bucket-qualified conversation path to its owning bucket
 * and the sub-path relative to that bucket. Shared across the persistence,
 * lifecycle, and streaming services since each resolves storage location
 * independently (rename, watch, duplicate all need the same logic).
 */
export const resolveConversationLocation = (
  conversationPath: string,
  sessionBucket: string,
): { bucket: string; subPath: string } => {
  if (
    conversationPath === sessionBucket ||
    conversationPath.startsWith(`${sessionBucket}/`)
  ) {
    return {
      bucket: sessionBucket,
      subPath:
        conversationPath === sessionBucket
          ? ''
          : conversationPath.slice(sessionBucket.length + 1),
    };
  }

  if (
    conversationPath === PUBLIC_BUCKET ||
    conversationPath.startsWith(`${PUBLIC_BUCKET}/`)
  ) {
    return {
      bucket: PUBLIC_BUCKET,
      subPath:
        conversationPath === PUBLIC_BUCKET
          ? ''
          : conversationPath.slice(PUBLIC_BUCKET.length + 1),
    };
  }

  const slashIndex = conversationPath.indexOf('/');
  if (slashIndex !== -1) {
    return {
      bucket: conversationPath.slice(0, slashIndex),
      subPath: conversationPath.slice(slashIndex + 1),
    };
  }
  return { bucket: sessionBucket, subPath: conversationPath };
};

/** Prefixes a bare (session-relative) conversation path with the session bucket. */
export const qualifySessionConversationPath = (
  conversationPath: string,
  sessionBucket: string,
): string =>
  conversationPath === sessionBucket ||
  conversationPath.startsWith(`${sessionBucket}/`)
    ? conversationPath
    : `${sessionBucket}/${conversationPath}`;

/**
 * Resolves the title to display for a list/detail item: the filename-derived
 * `pathTitle` unless the stored `name` is authoritative (set by LLM naming or
 * manual rename via `llmNamingDone`).
 */
export const resolveListDisplayTitle = (
  pathTitle: string,
  conversation: ConversationResponseDto,
): string => {
  const storedName = conversation.name?.trim();
  if (!storedName) {
    return pathTitle;
  }
  if (storedName === pathTitle) {
    return storedName;
  }

  /* `llmNamingDone` marks `name` as authoritative — set by LLM naming and by
   * manual rename, both of which update `name` at the same storage path, so
   * the filename-derived title may legitimately diverge from it.
   */
  return conversation.llmNamingDone === true ? storedName : pathTitle;
};
