import { normalizeMimeType } from '@epam/ai-dial-chat-shared';
import { extension as getMimeExtension } from 'mime-types';

/*
 * Kept apart from `attachment-types` so a host bundling the accept-type
 * helpers (needed on first paint by attachment validation) does not also pull
 * in `mime-types` and its full MIME database, which only these labels need.
 */

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
