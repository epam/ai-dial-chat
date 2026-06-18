const WILDCARD_TYPE_LABELS: Record<string, string> = {
  image: 'Image files',
  audio: 'Audio files',
  video: 'Video files',
  text: 'Text files',
};

/**
 * Converts an array of MIME type strings (including wildcards) into a
 * comma-separated human-readable label string.
 *
 * Examples:
 *   `['application/pdf', 'image/jpeg']` → `'PDF, JPEG'`
 *   `['image/*', 'text/csv']` → `'Image files, CSV'`
 */
export const mimeTypesToExtensionLabels = (types: string[]): string => {
  const labels = types.map((type) => {
    if (type.endsWith('/*')) {
      const major = type.slice(0, -2);
      return WILDCARD_TYPE_LABELS[major] ?? `${major} files`;
    }
    const subtype = type.split('/')[1];
    return subtype != null ? subtype.toUpperCase() : type.toUpperCase();
  });
  return labels.join(', ');
};

/**
 * Returns `true` when `mimeType` matches at least one entry in `allowedTypes`.
 *
 * Matching rules:
 * - Exact match: `'application/pdf'` allows `'application/pdf'`.
 * - Wildcard prefix: `'image/*'` allows any `'image/...'` MIME type.
 *
 * Returns `true` when `allowedTypes` is empty (no restriction applied).
 */
export const isMimeTypeAllowed = (
  mimeType: string,
  allowedTypes: string[],
): boolean => {
  if (allowedTypes.length === 0) return true;
  return allowedTypes.some((allowed) => {
    if (allowed === '*' || allowed === '*/*') return true;
    if (allowed.endsWith('/*')) {
      const prefix = allowed.slice(0, -2);
      return mimeType.startsWith(`${prefix}/`);
    }
    return mimeType === allowed;
  });
};
