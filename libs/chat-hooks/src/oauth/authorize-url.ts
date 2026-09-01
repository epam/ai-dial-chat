import type { ToolsetOAuthSettings } from './models';

/**
 * Resolves the OAuth callback location against the current origin. The
 * callback path is supplied by the host: this module owns no application
 * route.
 */
export const getToolsetRedirectUri = (callbackPath: string): string =>
  `${window.location.origin}${callbackPath}`;

/**
 * Hosts on the loopback interface, matched exactly so a public host that
 * merely starts with `localhost` is never mistaken for one.
 */
const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '[::1]' ||
  /^127(?:\.\d{1,3}){3}$/.test(hostname);

/**
 * Whether the provider can be reached without exposing the authorization
 * code it returns. `https:` always qualifies. Plain `http:` qualifies only on
 * the loopback interface, where the request never reaches a network that could
 * observe it (RFC 8252 §7.3) — a remote `http:` authorization endpoint would
 * leak the code in the redirect URL to any passive observer, which PKCE does
 * not prevent when the challenge is verified server-side.
 */
const isEndpointTransportSecure = (url: URL): boolean => {
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && isLoopbackHost(url.hostname);
};

/**
 * Builds the OAuth authorize URL for a given, already-generated `state`
 * value. The caller owns what `state` carries — see `initiateOAuthLogin`.
 * Returns `null` rather than throwing for a configuration that cannot
 * produce a valid URL, including one whose authorization endpoint is not
 * reachable over a secure transport.
 */
export const buildToolsetAuthorizeUrl = (
  auth: ToolsetOAuthSettings,
  redirectUri: string,
  state: string,
): string | null => {
  if (!auth.authorizationEndpoint?.trim() || !auth.clientId?.trim()) {
    return null;
  }
  try {
    const url = new URL(auth.authorizationEndpoint.trim());
    if (!isEndpointTransportSecure(url)) {
      return null;
    }
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', auth.clientId.trim());
    url.searchParams.set('redirect_uri', redirectUri);
    if (auth.codeChallenge) {
      url.searchParams.set('code_challenge', auth.codeChallenge);
    }
    if (auth.codeChallengeMethod) {
      url.searchParams.set('code_challenge_method', auth.codeChallengeMethod);
    }
    url.searchParams.set('state', state);
    if (auth.scopes && auth.scopes.length > 0) {
      url.searchParams.set('scope', auth.scopes.join(' '));
    }
    return url.toString();
  } catch {
    return null;
  }
};
