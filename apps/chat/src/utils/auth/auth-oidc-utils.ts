const OIDC_DISCOVERY_PATH = '/.well-known/openid-configuration';
const OIDC_DISCOVERY_PATH_PATTERN = /\/+\.well-known\/openid-configuration$/;

export const normalizeOidcWellKnownUrl = (wellKnown: string): string => {
  try {
    const url = new URL(wellKnown);
    url.pathname = url.pathname.replace(
      OIDC_DISCOVERY_PATH_PATTERN,
      OIDC_DISCOVERY_PATH,
    );
    return url.toString();
  } catch {
    return wellKnown;
  }
};
