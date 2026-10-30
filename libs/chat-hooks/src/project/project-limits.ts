/** Defaults matching the BFF's `PROJECT_CONTEXT_*` defaults, used before the client config loads. */
export const DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES = 1_048_576;
export const DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES = 10_485_760;
export const DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS = [
  'csv',
  'pdf',
  'xlsx',
];

/** Returns `value` when it is a positive finite number, otherwise `fallback`. */
export const resolveByteLimit = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;

/**
 * Returns `value` lower-cased when it is a non-empty array of non-empty
 * strings, otherwise `fallback`. An older BFF omits the field entirely.
 */
export const resolveExtensionList = (
  value: unknown,
  fallback: string[],
): string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((entry) => typeof entry === 'string' && entry.length > 0)
    ? value.map((entry: string) => entry.toLowerCase())
    : fallback;

/**
 * Returns every MIME type `MIME_TYPE_EXT_MAP` maps to one of `extensions`,
 * for the file manager's MIME-based `allowedTypes` filter.
 */
export const getMimeTypesForExtensions = (
  extensions: string[],
  mimeTypeExtensions: Record<string, string>,
): string[] => {
  const wanted = new Set(
    extensions.map((extension) => extension.toLowerCase()),
  );
  return Object.entries(mimeTypeExtensions)
    .filter(([, extension]) => wanted.has(extension))
    .map(([mimeType]) => mimeType);
};
