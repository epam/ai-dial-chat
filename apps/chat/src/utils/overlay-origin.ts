const WILDCARD_PATTERN = /^(https?):\/\/\*\.(.+)$/;
const ORIGIN_PATTERN = /^(https?):\/\/(.+)$/;

const matchesPattern = (origin: string, pattern: string): boolean => {
  const wildcard = WILDCARD_PATTERN.exec(pattern);
  if (!wildcard) {
    return origin === pattern;
  }

  const [, scheme, baseHost] = wildcard;
  const exact = ORIGIN_PATTERN.exec(origin);
  if (!exact) {
    return false;
  }

  const [, originScheme, originHost] = exact;
  return originScheme === scheme && originHost.endsWith(`.${baseHost}`);
};

/**
 * Matches an origin against an allowlist that may contain exact origins
 * (`scheme://host[:port]`) and/or a single leading-wildcard-label pattern
 * (`scheme://*.host[:port]`), mirroring the backend's ALLOWED_IFRAME_ORIGINS
 * validation grammar.
 */
export const matchesAllowedOrigin = (
  origin: string,
  allowedOrigins: string[],
): boolean => allowedOrigins.some((pattern) => matchesPattern(origin, pattern));
