/** Maximum file size that can be selected for attachment (512 MB). Matches the legacy FileManagerModal default. */
export const MAX_SELECTABLE_FILE_SIZE_BYTES = 512 * 1024 * 1024;

/** Maximum file size selectable for an avatar/icon upload (1 MB). */
export const AVATAR_MAX_FILE_SIZE_BYTES = 1024 * 1024;

/** MIME types selectable for an avatar/icon upload. */
export const AVATAR_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
];
