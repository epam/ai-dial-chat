import { NOT_ALLOWED_SYMBOLS_REGEXP } from '@epam/ai-dial-ui-kit';

/**
 * Sanitizes a filename for upload by replacing forbidden characters with `_`
 * and trimming trailing dots/whitespace from the base name.
 *
 * Mutates nothing — returns a new string. The caller (onValidateUpload) is
 * responsible for writing the result back to DialUploadFileItem.name so the
 * ui-kit's subsequent conflict detection sees the sanitized name.
 *
 * If the base name is empty after sanitization, returns the original name unchanged.
 */
export const sanitizeFileName = (name: string): string => {
  const lastDot = name.lastIndexOf('.');
  const hasExtension = lastDot > 0;

  const baseName = hasExtension ? name.slice(0, lastDot) : name;
  const extension = hasExtension ? name.slice(lastDot) : '';

  const sanitizedBase = baseName
    .replace(new RegExp(NOT_ALLOWED_SYMBOLS_REGEXP.source, 'g'), '_')
    .replace(/[.\s]+$/, '');

  if (sanitizedBase === '') {
    return name;
  }

  return `${sanitizedBase}${extension}`;
};
