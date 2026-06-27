/**
 * DIAL deployment / toolset identifier.
 * Allows word chars, `.:-@/`, and valid `%XX` bytes.
 * Rejects whitespace, `;`, `,`, `=`, `{`, `}`, `&`, `\`, `"`, malformed `%` sequences, etc.
 */
export const DEPLOYMENT_ID_PATTERN = /^(?:[\w.\-:@/]|%[\dA-Fa-f]{2})+$/;

export const DEPLOYMENT_ID_VALIDATION_MESSAGE =
  'Must contain only supported characters or valid percent-encoded bytes';
