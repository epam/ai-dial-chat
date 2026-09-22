import { normalizeMimeType } from '@epam/ai-dial-chat-shared';
import type { DialFileAcceptType } from '@epam/ai-dial-react-file-manager';
import { extension as getMimeExtension } from 'mime-types';

const ALL_FILES_ACCEPT_TYPE: DialFileAcceptType = '*/*';

/** Narrows a string to a `DialFileAcceptType` — a dotted extension or a MIME type/wildcard. */
export const isDialFileAcceptType = (
  type: string,
): type is DialFileAcceptType => type.startsWith('.') || type.includes('/');

/**
 * Normalizes `*` to the all-files wildcard, canonicalizes MIME aliases, and drops
 * any value that is not a valid `DialFileAcceptType`.
 *
 * Aliases are resolved because a file picker matches an `accept` entry against its
 * own MIME table: a declared `text/json` offers no `.json` file, while the
 * `application/json` it denotes does.
 */
export const mimeTypesToDialFileAcceptTypes = (
  types?: string[],
): DialFileAcceptType[] | undefined => {
  if (types == null) {
    return undefined;
  }

  return types
    .map((type) => {
      if (type === '*') return ALL_FILES_ACCEPT_TYPE;
      // A dotted extension is not a MIME type and must pass through untouched.
      return type.startsWith('.') ? type : normalizeMimeType(type);
    })
    .filter(isDialFileAcceptType);
};

/**
 * Builds an `<input accept>` string from resolved MIME types, filtering out
 * any value `isDialFileAcceptType` rejects, or `undefined` when no types are
 * given or any type accepts everything.
 */
export const mimeTypesToFileAccept = (types?: string[]): string | undefined => {
  const dialFileAcceptTypes = mimeTypesToDialFileAcceptTypes(types);
  if (dialFileAcceptTypes == null || dialFileAcceptTypes.length === 0) {
    return undefined;
  }
  if (dialFileAcceptTypes.some((type) => type === ALL_FILES_ACCEPT_TYPE)) {
    return undefined;
  }
  return dialFileAcceptTypes.join(',');
};

/** Formats MIME types as a human-readable, comma-separated list of dotted extensions (or the MIME type itself for wildcards). */
export const mimeTypesToAttachmentExtensionLabels = (types: string[]): string =>
  types
    .map((type) => {
      if (type.endsWith('/*')) {
        return type;
      }

      const canonicalType = normalizeMimeType(type);
      const extension = getMimeExtension(canonicalType);

      if (extension !== false) {
        return `.${extension}`;
      }

      const subtype = canonicalType.split('/')[1];
      return subtype != null ? `.${subtype.toLowerCase()}` : type;
    })
    .join(', ');
