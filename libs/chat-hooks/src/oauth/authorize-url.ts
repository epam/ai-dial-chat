import type { ToolsetOAuthSettings } from './models';

/**
 * Resolves the OAuth callback location against the current origin. The
 * callback path is supplied by the host: this module owns no application
 * route.
 */
export const getToolsetRedirectUri = (callbackPath: string): string =>
  `${window.location.origin}${callbackPath}`;

/**
 * Builds the OAuth authorize URL for a given, already-generated `state`
 * value. The caller owns what `state` carries — see `initiateOAuthLogin`.
 * Returns `null` rather than throwing for a configuration that cannot
 * produce a valid URL.
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
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
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
