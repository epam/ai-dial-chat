import {
  getUtf8ByteLength,
  truncateToUtf8Bytes,
} from '@epam/ai-dial-chat-shared';
import { NOT_ALLOWED_SYMBOLS_REGEXP } from '@epam/ai-dial-ui-kit';

/** Splits a file name into its base and extension, using only the last dot. */
export const splitFileNameExtension = (
  fileName: string,
): { base: string; extension: string } => {
  const dotIndex = fileName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  return {
    base: hasExtension ? fileName.slice(0, dotIndex) : fileName,
    extension: hasExtension ? fileName.slice(dotIndex) : '',
  };
};

export const trimFileNameToByteLimit = (name: string, limit = 255): string => {
  if (getUtf8ByteLength(name) <= limit) return name;

  const { base, extension: ext } = splitFileNameExtension(name);
  const extBytes = getUtf8ByteLength(ext);
  const baseLimit = limit - extBytes;

  if (baseLimit <= 0) {
    return truncateToUtf8Bytes(name, limit);
  }

  return `${truncateToUtf8Bytes(base, baseLimit)}${ext}`;
};

const TRAILING_TRIMMABLE_CHAR = /[.\s]/;

/*
 * Trailing dots and whitespace are trimmed by index scan rather than a
 * `/[.\s]+$/` regex: repetition anchored at `$` with an unanchored start makes
 * the engine retry from every offset, so a name that is mostly dots costs
 * quadratic time (CodeQL js/polynomial-redos). Testing one character at a time
 * keeps `\s` semantics while staying linear.
 */
const stripTrailingDotsAndWhitespace = (value: string): string => {
  let end = value.length;
  while (end > 0 && TRAILING_TRIMMABLE_CHAR.test(value[end - 1])) end -= 1;
  return value.slice(0, end);
};

/**
 * Sanitizes a filename for upload by replacing forbidden characters with `_`,
 * trimming trailing dots/whitespace from the base name, and capping the result
 * to 255 UTF-8 bytes.
 *
 * Mutates nothing — returns a new string. The caller (onValidateUpload) is
 * responsible for writing the result back to DialUploadFileItem.name so the
 * ui-kit's subsequent conflict detection sees the sanitized name.
 *
 * If the base name is empty after sanitization, returns the original name unchanged.
 */
export const sanitizeFileName = (name: string): string => {
  const { base: baseName, extension } = splitFileNameExtension(name);

  const sanitizedBase = stripTrailingDotsAndWhitespace(
    baseName.replace(new RegExp(NOT_ALLOWED_SYMBOLS_REGEXP.source, 'g'), '_'),
  );

  if (sanitizedBase === '') {
    return name;
  }

  return trimFileNameToByteLimit(`${sanitizedBase}${extension}`);
};
