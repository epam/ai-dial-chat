/**
 * DIAL Core bucket name.
 * Allows word chars, `.`, and `-`.
 */
export const BUCKET_NAME_PATTERN = /^[\w.-]+$/;

export const BUCKET_NAME_VALIDATION_MESSAGE =
  'Must contain only letters, digits, underscores, dots, or hyphens';
