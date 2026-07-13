/**
 * DIAL Core invitation identifier.
 * Allows word chars and hyphens only.
 */
export const INVITATION_ID_PATTERN = /^[\w-]+$/;

export const INVITATION_ID_VALIDATION_MESSAGE =
  'Must contain only letters, digits, hyphens, and underscores';
