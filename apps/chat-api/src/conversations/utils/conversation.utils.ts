import { StringUtils } from '../../common/utils/string-utils';
import { COMPOUND_TOKEN_PREFIX } from '../constants/conversation.constants';
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

const isDeploymentVersionSuffix = (value?: string): boolean => {
  if (!value) return false;

  const numericVersion = value.split(VERSION_METADATA_SEPARATOR_REGEX)[0];
  return numericVersion
    .split('.')
    .every((part) => VERSION_NUMBER_PART_REGEX.test(part));
};

const isUuid = (value: string): boolean => {
  const parts = value.split('-');
  return (
    parts.length === UUID_PART_LENGTHS.length &&
    parts.every(
      (part, index) =>
        part.length === UUID_PART_LENGTHS[index] && HEX_REGEX.test(part),
    )
  );
};

const getDeploymentNameParts = (filenameParts: string[]): string[] => {
  const [name = '', versionSuffix] = filenameParts;
  return isDeploymentVersionSuffix(versionSuffix)
    ? [name, versionSuffix]
    : [name];
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
 */
export const getConversationTitleFromName = (name: string): string => {
  const parts = name.split(CONVERSATION_NAME_SEPARATOR);
  if (parts.length < 2) return name;

  const deploymentNameParts = getDeploymentNameParts(parts);
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
 */
export const buildRenamedFilename = (
  filename: string,
  sanitisedTitle: string,
): string => {
  const parts = filename.split(CONVERSATION_NAME_SEPARATOR);
  if (parts.length < 2) return sanitisedTitle;

  const deploymentNameParts = getDeploymentNameParts(parts);
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
 */
export const getDeploymentKey = (filename: string): string => {
  const parts = filename.split(CONVERSATION_NAME_SEPARATOR);
  return getDeploymentNameParts(parts).join(CONVERSATION_NAME_SEPARATOR);
};

/**
 * Builds the new conversation path by replacing the title segment in the filename.
 * Preserves versioned application deployment IDs and legacy UUID suffixes.
 */
export const buildRenamedConversationPath = (
  conversationPath: string,
  sanitisedTitle: string,
): string => {
  const segments = conversationPath.split('/');
  const filename = segments[segments.length - 1];
  const renamedFilename = buildRenamedFilename(filename, sanitisedTitle);

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
