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
