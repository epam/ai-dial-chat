/*
 * Matches an exact origin (scheme://host[:port]) or a single
 * leading-wildcard-label origin pattern (scheme://*.host[:port]), with no
 * path, query string, or fragment. Mirrors CSP's own host-source wildcard
 * grammar so a wildcard entry can be forwarded verbatim into
 * `frame-src`/`frame-ancestors`.
 */
export const IFRAME_ORIGIN_PATTERN =
  /^(https?):\/\/(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*(?::\d+)?$/;
