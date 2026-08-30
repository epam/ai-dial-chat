import { generateUUID } from '@epam/ai-dial-chat-shared';
import {
  buildToolsetAuthorizeUrl,
  getToolsetRedirectUri,
} from './authorize-url';
import type {
  ToolsetOAuthInitiationResult,
  ToolsetOAuthSettings,
  ToolsetRedirectState,
} from './models';
import {
  OAuthResourceKind,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
} from './types';

/**
 * Writes the redirect state into the given popup's own `sessionStorage`
 * (while it is still same-origin `about:blank`) and navigates it to the
 * provider's authorization page. Writing into the popup's own storage
 * (rather than the opener's) is what makes the redirect state reliably
 * readable by the callback route once the provider redirects back into that
 * same popup — the two browsing contexts do not share a `sessionStorage`
 * partition.
 */
const writeRedirectStateAndNavigate = (
  popup: Window,
  url: string,
  state: string,
  toolsetId: string,
  credentialsLevel: ToolsetCredentialsLevel,
  redirectUri: string,
  resourceKind: OAuthResourceKind = OAuthResourceKind.Toolset,
  offlineUsageConsent?: boolean,
): ToolsetOAuthInitiationResult => {
  const redirectState: ToolsetRedirectState = {
    toolsetId,
    credentialsLevel,
    redirectUri,
    state,
    resourceKind,
    offlineUsageConsent,
  };
  popup.sessionStorage.setItem(
    TOOLSET_REDIRECT_STATE_KEY,
    JSON.stringify(redirectState),
  );

  /*
   * The provider URL is external input. Sever the relationship while the
   * placeholder is still same-origin so the provider cannot navigate the
   * initiating tab through `window.opener` after the cross-origin navigation.
   */
  popup.opener = null;
  popup.location.href = url;

  return {
    type: ToolsetOAuthInitiationResultType.Started,
    popup,
    flowId: state,
  };
};

/**
 * Opens a same-origin, blank popup synchronously — call this as the very
 * first thing in a click (or click-derived) handler so the browser still
 * treats it as user-triggered, before doing any `await`. A caller that needs
 * to fetch the OAuth config first (it isn't known synchronously) opens the
 * popup with this, then calls `navigateToolsetOAuthPopup` once the config has
 * been fetched.
 */
export const openToolsetOAuthPopup = (): Window | null =>
  window.open('', '_blank');

/**
 * Builds the OAuth authorize URL for an already-open popup and navigates it,
 * closing the popup and returning `InvalidConfig` if the auth config can't
 * produce a valid authorize URL. `callbackPath` is the host's own callback
 * route — this module owns no application route.
 */
export const navigateToolsetOAuthPopup = (
  popup: Window,
  auth: ToolsetOAuthSettings,
  toolsetId: string,
  callbackPath: string,
  credentialsLevel: ToolsetCredentialsLevel = ToolsetCredentialsLevel.User,
  resourceKind: OAuthResourceKind = OAuthResourceKind.Toolset,
  offlineUsageConsent?: boolean,
): ToolsetOAuthInitiationResult => {
  const redirectUri = getToolsetRedirectUri(callbackPath);
  const state = generateUUID();
  const url = buildToolsetAuthorizeUrl(auth, redirectUri, state);
  if (!url) {
    popup.close();
    return { type: ToolsetOAuthInitiationResultType.InvalidConfig };
  }
  return writeRedirectStateAndNavigate(
    popup,
    url,
    state,
    toolsetId,
    credentialsLevel,
    redirectUri,
    resourceKind,
    offlineUsageConsent,
  );
};

/**
 * Builds the OAuth authorize URL, opens a same-origin popup synchronously (so
 * a blocked popup can be reliably detected), writes the redirect state into
 * *that popup's own* `sessionStorage` while it is still same-origin
 * `about:blank`, then navigates it to the provider's authorization page.
 * `auth` must already be known synchronously here, so the config is validated
 * *before* opening the popup — unlike `navigateToolsetOAuthPopup`, used when
 * the auth config can only be fetched asynchronously after the popup is
 * already open.
 */
export const initiateOAuthLogin = (
  auth: ToolsetOAuthSettings,
  toolsetId: string,
  callbackPath: string,
  credentialsLevel: ToolsetCredentialsLevel = ToolsetCredentialsLevel.User,
): ToolsetOAuthInitiationResult => {
  const redirectUri = getToolsetRedirectUri(callbackPath);
  const state = generateUUID();
  const url = buildToolsetAuthorizeUrl(auth, redirectUri, state);
  if (!url) return { type: ToolsetOAuthInitiationResultType.InvalidConfig };

  const popup = openToolsetOAuthPopup();
  if (!popup) return { type: ToolsetOAuthInitiationResultType.Blocked };

  return writeRedirectStateAndNavigate(
    popup,
    url,
    state,
    toolsetId,
    credentialsLevel,
    redirectUri,
  );
};
