/**
 * DIAL deployment / toolset identifier.
 * Allows word chars, `.:-@/()+`, and valid `%XX` bytes. DIAL Core keeps `+`
 * raw in the ids it emits for a version such as `1.0+build5`.
 * Rejects whitespace, `;`, `,`, `=`, `{`, `}`, `&`, `\`, `"`, malformed `%` sequences, etc.
 */
export const DEPLOYMENT_ID_PATTERN = /^(?:[\w.\-:@/()+]|%[\dA-Fa-f]{2})+$/;

export const DEPLOYMENT_ID_VALIDATION_MESSAGE =
  '$property must contain only supported characters or valid percent-encoded bytes';
