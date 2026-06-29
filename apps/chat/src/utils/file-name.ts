import { NOT_ALLOWED_SYMBOLS_REGEXP } from '@epam/ai-dial-ui-kit';

/**
 * Trims a filename so its UTF-8 byte length does not exceed `limit` (default 255).
 * Splits on character boundaries to avoid truncating multi-byte sequences.
 * Preserves the file extension when possible.
 */
export const trimFileNameToByteLimit = (name: string, limit = 255): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(name).length <= limit) return name;

  const lastDot = name.lastIndexOf('.');
  const hasExtension = lastDot > 0;
  const base = hasExtension ? name.slice(0, lastDot) : name;
  const ext = hasExtension ? name.slice(lastDot) : '';
  const extBytes = encoder.encode(ext).length;
  const baseLimit = limit - extBytes;

  if (baseLimit <= 0) {
    let result = '';
    let bytes = 0;
    for (const char of name) {
      const charBytes = encoder.encode(char).length;
      if (bytes + charBytes > limit) break;
      result += char;
      bytes += charBytes;
    }
    return result;
  }

  let trimmedBase = '';
  let bytes = 0;
  for (const char of base) {
    const charBytes = encoder.encode(char).length;
    if (bytes + charBytes > baseLimit) break;
    trimmedBase += char;
    bytes += charBytes;
  }

  return `${trimmedBase}${ext}`;
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

  return trimFileNameToByteLimit(`${sanitizedBase}${extension}`);
};
