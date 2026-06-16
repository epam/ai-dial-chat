import { StringUtils } from '../../common/utils/string-utils';
import { COMPOUND_TOKEN_PREFIX } from '../constants/conversation.constants';
import type { CompoundNextToken } from '../types/conversation.types';

const notAllowedSymbolsRegex = /[:;,=/{}%&"]/g;
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
 * Builds the new conversation path by replacing the title segment in the filename.
 * Preserves versioned application deployment IDs and legacy UUID suffixes.
 */
export const buildRenamedConversationPath = (
  conversationPath: string,
  sanitisedTitle: string,
): string => {
  const segments = conversationPath.split('/');
  const filename = segments[segments.length - 1];
  const parts = filename.split(CONVERSATION_NAME_SEPARATOR);
  if (parts.length < 2) {
    return segments.length > 1
      ? [...segments.slice(0, -1), sanitisedTitle].join('/')
      : sanitisedTitle;
  }

  const deploymentNameParts = getDeploymentNameParts(parts);
  const hasVersionedDeployment = deploymentNameParts.length > 1;
  const hasLegacySuffix = hasVersionedDeployment
    ? isUuid(parts[parts.length - 1])
    : parts.length >= 3;
  const legacySuffix = hasLegacySuffix ? parts[parts.length - 1] : undefined;
  const renamedFilename = [
    ...deploymentNameParts,
    sanitisedTitle,
    ...(legacySuffix ? [legacySuffix] : []),
  ].join(CONVERSATION_NAME_SEPARATOR);

  return segments.length > 1
    ? [...segments.slice(0, -1), renamedFilename].join('/')
    : renamedFilename;
};

/** Decodes a URI component, returning the original string if decoding fails. */
export const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// TODO: Remove this once the DIAL SDK encodes resource path segments internally.
export const encodeDialResourcePath = (path: string): string =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join('/');

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
