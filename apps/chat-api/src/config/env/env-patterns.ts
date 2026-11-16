/*
 * Matches an exact origin (scheme://host[:port]) or a single
 * leading-wildcard-label origin pattern (scheme://*.host[:port]), with no
 * path, query string, or fragment. Mirrors CSP's own host-source wildcard
 * grammar so a wildcard entry can be forwarded verbatim into
 * `frame-src`/`frame-ancestors`.
 */
export const IFRAME_ORIGIN_PATTERN =
  /^(https?):\/\/(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*(?::\d+)?$/;

/*
 * An application identifier: lowercase, 1–63 characters, no leading hyphen.
 * The same rule Config Studio enforces for an instance's `appId`, so every
 * served identifier can name a Studio instance.
 */
export const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/*
 * A Config Studio runner instance ID, which is a DIAL Core deployment ID:
 * the same rule the Config Studio backend applies to the instances it serves.
 */
export const MANAGED_CONFIG_INSTANCE_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
