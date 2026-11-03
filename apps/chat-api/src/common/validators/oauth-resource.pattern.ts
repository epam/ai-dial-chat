/*
 * RFC 8707 resource indicator for an OAuth client (`auth_settings.resource`):
 * an absolute URI (scheme, `:`, then no whitespace and no `#fragment`), or an
 * empty string, which DIAL Core reads as "clear the stored value". DIAL Core
 * enforces the same rule; checking it here keeps whitespace and line breaks
 * out of log lines and error messages.
 */
export const OAUTH_RESOURCE_PATTERN = /^(?:[A-Za-z][A-Za-z0-9+.-]*:[^\s#]+)?$/;

export const OAUTH_RESOURCE_MAX_LENGTH = 2048;

export const OAUTH_RESOURCE_VALIDATION_MESSAGE =
  '$property must be empty or an absolute URI without a fragment';
