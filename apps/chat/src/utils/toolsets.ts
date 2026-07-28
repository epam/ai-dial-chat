import { validateDeploymentCreationFields } from '@epam/ai-dial-deployment-creation-form';
import type { DialToolsetDto, ToolsetBodyDto } from '@epam/chat-api-client';
import { ResponseError } from '@epam/chat-api-client';
import {
  DEFAULT_TOOLSET_NAME,
  DEFAULT_TOOLSET_VERSION,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetOAuthCallbackQuery,
} from '../constants/toolsets';
import { ROUTES } from '../types/routes';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetOAuthChannelMessage,
  ToolsetOAuthInitiationResult,
  ToolsetOAuthResult,
  ToolsetRedirectState,
} from '../types/toolsets';
import {
  ToolsetAuthStatus,
  ToolsetAuthTypes,
  ToolsetOAuthChannelControlType,
  ToolsetCredentialsLevel,
  ToolsetOAuthFailureReason,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  ToolsetTransportType,
  WithLogin,
} from '../types/toolsets';

/**
 * Returns a storage-safe toolset name that does not collide with any existing
 * name, appending a numeric suffix when the default name is taken.
 */
export const getStorageSafeUniqueToolsetName = ({
  defaultName = DEFAULT_TOOLSET_NAME,
  existingNames,
}: {
  defaultName?: string;
  existingNames: string[];
}): string => {
  const taken = new Set(existingNames);
  if (!taken.has(defaultName)) return defaultName;

  let suffix = 1;
  while (taken.has(`${defaultName} ${suffix}`)) suffix += 1;
  return `${defaultName} ${suffix}`;
};

const getDefaultAuthFormData = (): ToolsetAuthFormData => ({
  authenticationType: ToolsetAuthTypes.None,
  withLogin: WithLogin.WithoutLogin,
  isLoggedIn: false,
});

export const getDefaultToolsetForm = (
  existingNames: string[] = [],
): ToolsetFormData => ({
  name: getStorageSafeUniqueToolsetName({ existingNames }),
  version: DEFAULT_TOOLSET_VERSION,
  iconUrl: '',
  description: '',
  topics: [],
  intro: '',
  endpoint: '',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: getDefaultAuthFormData(),
});

const isSignedIn = (status?: string): boolean =>
  status === ToolsetAuthStatus.SignedIn;

/**
 * Percent-encodes each `/`-separated segment of a toolset id so it satisfies
 * the backend's `DEPLOYMENT_ID_PATTERN`/`TOOLSET_URL_PATTERN` (spaces and
 * other reserved characters must already be percent-encoded — e.g. `%20`,
 * not a real space — before this value is used against the toolsets API;
 * `/` stays a literal path separator). The `toolsetId` a QuickApps iframe
 * sends over `postMessage` (`REQUEST_TOOLSET_LOGIN`) is the raw,
 * human-readable id (e.g. `toolsets/<bucket>/My Toolset__1.0`), unlike the
 * already-encoded `id`/`toolset` field chat's own `listToolsets()`/
 * `DialToolsetDto` returns — mirrors `encodeDeploymentId`
 * (`utils/deployment-id.ts`), which exists for the identical reason on the
 * applications side.
 */
export const encodeToolsetId = (id: string): string =>
  id
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

/**
 * Builds the OAuth authorize URL for a given, already-generated `state`
 * value. The caller owns what `state` carries — see `initiateOAuthLogin`.
 */
export const buildToolsetAuthorizeUrl = (
  auth: ToolsetAuthFormData,
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

export const getToolsetRedirectUri = (): string =>
  `${window.location.origin}${ROUTES.ToolsetSignIn}`;

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
): ToolsetOAuthInitiationResult => {
  const redirectState: ToolsetRedirectState = {
    toolsetId,
    credentialsLevel,
    redirectUri,
    state,
  };
  popup.sessionStorage.setItem(
    TOOLSET_REDIRECT_STATE_KEY,
    JSON.stringify(redirectState),
  );

  /*
   * The provider URL is external input. Sever the relationship while the
   * placeholder is still same-origin so the provider cannot navigate the
   * Chat tab through `window.opener` after the cross-origin navigation.
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
 * to fetch the toolset's auth config first (it isn't known synchronously)
 * opens the popup with this, then calls `navigateToolsetOAuthPopup` once the
 * config has been fetched.
 */
export const openToolsetOAuthPopup = (): Window | null =>
  window.open('', '_blank');

/**
 * Builds the OAuth authorize URL for an already-open popup and navigates it,
 * closing the popup and returning `InvalidConfig` if the auth config can't
 * produce a valid authorize URL.
 */
export const navigateToolsetOAuthPopup = (
  popup: Window,
  auth: ToolsetAuthFormData,
  toolsetId: string,
  credentialsLevel: ToolsetCredentialsLevel = ToolsetCredentialsLevel.User,
): ToolsetOAuthInitiationResult => {
  const redirectUri = getToolsetRedirectUri();
  const state = crypto.randomUUID();
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
  );
};

/**
 * Builds the OAuth authorize URL, opens a same-origin popup synchronously (so
 * a blocked popup can be reliably detected), writes the redirect state into
 * *that popup's own* `sessionStorage` while it is still same-origin
 * `about:blank`, then navigates it to the provider's authorization page.
 * Shared by the post-save auto-login flow (Editor, always `USER`) and the
 * manual Log In action (Editor or Catalog, `USER` or `GLOBAL`) so all trigger
 * points stay in sync. `auth` must already be known synchronously here, so
 * config is validated *before* opening the popup — unlike
 * `navigateToolsetOAuthPopup`, used when the auth config can only be fetched
 * asynchronously after the popup is already open.
 */
export const initiateOAuthLogin = (
  auth: ToolsetAuthFormData,
  toolsetId: string,
  credentialsLevel: ToolsetCredentialsLevel = ToolsetCredentialsLevel.User,
): ToolsetOAuthInitiationResult => {
  const redirectUri = getToolsetRedirectUri();
  const state = crypto.randomUUID();
  const url = buildToolsetAuthorizeUrl(auth, redirectUri, state);
  if (!url) return { type: ToolsetOAuthInitiationResultType.InvalidConfig };

  const popup = window.open('', '_blank');
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

const TOOLSET_OAUTH_CHANNEL_PREFIX = 'toolset-oauth-';

/** Name of the same-origin `BroadcastChannel` shared by an OAuth flow's opener and its callback popup. */
export const getToolsetOAuthChannelName = (flowId: string): string =>
  `${TOOLSET_OAUTH_CHANNEL_PREFIX}${flowId}`;

const DEFAULT_OAUTH_RESULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_OAUTH_POPUP_POLL_INTERVAL_MS = 500;

const getOAuthFailureReason = (
  value: string | null,
): ToolsetOAuthFailureReason => {
  switch (value) {
    case ToolsetOAuthFailureReason.MissingCode:
    case ToolsetOAuthFailureReason.MissingRedirectState:
    case ToolsetOAuthFailureReason.StateMismatch:
    case ToolsetOAuthFailureReason.LoginRequestFailed:
      return value;
    default:
      return ToolsetOAuthFailureReason.LoginRequestFailed;
  }
};

/**
 * Waits for the OAuth callback popup to report a result over BroadcastChannel
 * or through the completion marker in its same-origin URL. A cross-origin
 * provider can make the retained WindowProxy look closed even while the popup
 * remains open, so cancellation is confirmed only when the initiating window
 * regains focus. Reported results are acknowledged so the callback can close
 * itself even when the retained WindowProxy was severed.
 */
export const waitForToolsetOAuthResult = (
  popup: Window,
  flowId: string,
  {
    toolsetId,
    credentialsLevel,
    timeoutMs = DEFAULT_OAUTH_RESULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_OAUTH_POPUP_POLL_INTERVAL_MS,
  }: {
    toolsetId: string;
    credentialsLevel: ToolsetCredentialsLevel;
    timeoutMs?: number;
    pollIntervalMs?: number;
  },
): Promise<ToolsetOAuthResult> =>
  new Promise((resolve) => {
    let channel: BroadcastChannel | undefined;
    let settled = false;

    const finish = (outcome: ToolsetOAuthResult) => {
      if (settled) return;
      settled = true;
      clearInterval(pollId);
      clearTimeout(timeoutId);
      window.removeEventListener('focus', handleOpenerFocus);
      channel?.close();
      resolve(outcome);
    };

    const finishReportedResult = (result: ToolsetOAuthChannelMessage) => {
      channel?.postMessage({
        type: ToolsetOAuthChannelControlType.ResultAcknowledged,
      });
      try {
        popup.close();
      } catch {
        // The result is already consumed; popup cleanup is best-effort.
      }
      finish(result);
    };

    const readResultFromPopupUrl = (): ToolsetOAuthChannelMessage | null => {
      try {
        const popupUrl = new URL(popup.location.href);
        const isCallbackRoute =
          popupUrl.pathname === ROUTES.ToolsetSignIn ||
          popupUrl.pathname === ROUTES.ToolsetEditorCallback;
        if (popupUrl.origin !== window.location.origin || !isCallbackRoute) {
          return null;
        }

        const result = popupUrl.searchParams.get(
          ToolsetOAuthCallbackQuery.Result,
        );
        if (result === ToolsetOAuthResultType.Success) {
          return {
            type: ToolsetOAuthResultType.Success,
            toolsetId,
            credentialsLevel,
          };
        }
        if (result === ToolsetOAuthResultType.Failure) {
          return {
            type: ToolsetOAuthResultType.Failure,
            reason: getOAuthFailureReason(
              popupUrl.searchParams.get(
                ToolsetOAuthCallbackQuery.FailureReason,
              ),
            ),
          };
        }
      } catch {
        // Cross-origin popup URLs are unreadable until the provider returns.
      }
      return null;
    };

    const handleOpenerFocus = () => {
      const reportedResult = readResultFromPopupUrl();
      if (reportedResult != null) {
        finishReportedResult(reportedResult);
        return;
      }
      if (popup.closed) {
        finish({ type: ToolsetOAuthResultType.Cancelled });
      }
    };

    try {
      channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
      channel.onmessage = (event: MessageEvent<ToolsetOAuthChannelMessage>) => {
        finishReportedResult(event.data);
      };
    } catch {
      // URL polling is the deterministic fallback when channels are unavailable.
    }
    window.addEventListener('focus', handleOpenerFocus);

    const pollId = setInterval(() => {
      const reportedResult = readResultFromPopupUrl();
      if (reportedResult != null) {
        finishReportedResult(reportedResult);
        return;
      }
    }, pollIntervalMs);

    const timeoutId = setTimeout(() => {
      popup.close();
      finish({ type: ToolsetOAuthResultType.Cancelled });
    }, timeoutMs);

    const reportedResult = readResultFromPopupUrl();
    if (reportedResult != null) finishReportedResult(reportedResult);
  });

/**
 * Derives a human-readable name from a raw toolset id when no `DialToolsetDto`
 * is available yet (e.g. a `toolset/signin` event for a toolset whose
 * metadata hasn't loaded) — takes the last path segment, strips a trailing
 * `__version` suffix, and decodes percent-encoding.
 */
export const getToolsetFallbackName = (toolsetId: string): string => {
  const lastSegment = toolsetId.split('/').pop() ?? toolsetId;
  const [namePart] = lastSegment.split('__');
  try {
    return decodeURIComponent(namePart);
  } catch {
    return namePart;
  }
};

const TOOLSETS_ID_PREFIX = 'toolsets/';
const PUBLIC_BUCKET_SEGMENT = 'public';

/** Whether a toolset id belongs to the `public` bucket (shared with all users), mirroring the legacy `isEntityIdPublic` check. */
export const isPublicToolsetId = (toolsetId: string): boolean => {
  if (!toolsetId.startsWith(TOOLSETS_ID_PREFIX)) return false;
  const bucket = toolsetId.slice(TOOLSETS_ID_PREFIX.length).split('/')[0];
  return bucket === PUBLIC_BUCKET_SEGMENT;
};

const isValidEndpointUrlCandidate = (trimmed: string): boolean => {
  if (!/^(https?|sse):\/\//.test(trimmed)) return false;
  if (trimmed.endsWith('.') || trimmed.endsWith('//')) return false;
  try {
    return Boolean(new URL(trimmed));
  } catch {
    return false;
  }
};

/** Validates a toolset endpoint URL (http(s) or sse, parseable, no trailing `.`/`//`). */
export const isValidEndpointUrl = (value: string): boolean =>
  isValidEndpointUrlCandidate(value.trim());

const repairSingleSlashUrlScheme = (value: string): string =>
  value.replace(/^(https?|sse):\/([^/])/, '$1://$2');

const normalizeReturnedEndpointUrl = (value?: string): string => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || isValidEndpointUrlCandidate(trimmed)) return trimmed;

  const candidates = [trimmed];
  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded !== trimmed) candidates.push(decoded);
  } catch {
    // Leave malformed percent-encoded values unchanged.
  }

  for (const candidate of candidates) {
    const repaired = repairSingleSlashUrlScheme(candidate);
    if (isValidEndpointUrlCandidate(repaired)) return repaired;
  }

  return trimmed;
};

/** Maps a loaded toolset DTO (snake_case) into editor form state. */
export const toolsetDtoToForm = (dto: DialToolsetDto): ToolsetFormData => {
  const authSettings = dto.authSettings;
  const authenticationType =
    (authSettings?.authenticationType as ToolsetAuthTypes) ??
    ToolsetAuthTypes.None;
  /*
   * The editor's Log In button always authenticates at the `User` level
   * (see `AuthSection.handleLogIn` / `runPostSaveAuth`), so `isLoggedIn` must
   * reflect only `userLevelAuthStatus`. Folding in `globalAuthStatus` would
   * make the button disappear and skip auth validation/auto-login for a
   * user who never logged in themselves, just because an admin configured
   * global auth.
   */
  const isLoggedIn = isSignedIn(authSettings?.userLevelAuthStatus);

  let withLogin = WithLogin.WithLogin;
  if (authenticationType === ToolsetAuthTypes.None) {
    withLogin = WithLogin.WithoutLogin;
  } else if (
    authenticationType === ToolsetAuthTypes.OAuth &&
    authSettings?.dynamicallyRegistered === false
  ) {
    /*
     * A public client id exists for both dynamically registered and manually
     * configured OAuth clients. Core's explicit registration flag is the
     * reliable way to restore the editor mode.
     */
    withLogin = WithLogin.WithConfig;
  }

  return {
    name: dto.displayName ?? '',
    version: dto.displayVersion ?? DEFAULT_TOOLSET_VERSION,
    iconUrl: dto.iconUrl ?? '',
    description: dto.description ?? '',
    topics: dto.descriptionKeywords ?? [],
    intro: dto.intro ?? '',
    endpoint: normalizeReturnedEndpointUrl(dto.endpoint),
    protocol:
      (dto.transport as ToolsetTransportType) ?? ToolsetTransportType.Http,
    allowedTools: dto.allowedTools ?? [],
    reference: dto.reference,
    auth: {
      authenticationType,
      withLogin,
      isLoggedIn,
      keyHeader: authSettings?.apiKeyHeader ?? '',
      clientId: authSettings?.clientId ?? '',
      authorizationEndpoint: normalizeReturnedEndpointUrl(
        authSettings?.authorizationEndpoint,
      ),
      tokenEndpoint: normalizeReturnedEndpointUrl(authSettings?.tokenEndpoint),
      scopes: authSettings?.scopesSupported ?? [],
      codeChallenge: authSettings?.codeChallenge,
      codeChallengeMethod: authSettings?.codeChallengeMethod,
    },
  };
};

/** Maps editor form state into the create/update request body. */
export const formToToolsetBody = (
  form: ToolsetFormData,
  redirectUri?: string,
): ToolsetBodyDto => {
  const auth = form.auth;
  const authSettings: ToolsetBodyDto['authSettings'] = {
    authenticationType: auth.authenticationType,
  };
  if (auth.authenticationType === ToolsetAuthTypes.ApiKey) {
    authSettings.apiKeyHeader = auth.keyHeader?.trim() || undefined;
  } else if (auth.authenticationType === ToolsetAuthTypes.OAuth) {
    authSettings.clientId = auth.clientId?.trim() || undefined;
    authSettings.clientSecret = auth.clientSecret?.trim() || undefined;
    authSettings.authorizationEndpoint =
      normalizeReturnedEndpointUrl(auth.authorizationEndpoint) || undefined;
    authSettings.tokenEndpoint =
      normalizeReturnedEndpointUrl(auth.tokenEndpoint) || undefined;
    authSettings.redirectUri = redirectUri?.trim() || undefined;
    authSettings.scopesSupported =
      auth.scopes && auth.scopes.length > 0 ? auth.scopes : undefined;
  }

  return {
    name: form.name.trim(),
    version: form.version.trim() || DEFAULT_TOOLSET_VERSION,
    description: form.description.trim() || undefined,
    iconUrl: form.iconUrl.trim() || undefined,
    topics: form.topics.length > 0 ? form.topics : undefined,
    intro: form.intro.trim() || undefined,
    endpoint: normalizeReturnedEndpointUrl(form.endpoint),
    transport: form.protocol,
    allowedTools: form.allowedTools.length > 0 ? form.allowedTools : undefined,
    reference: form.reference,
    authSettings,
  };
};

const isOptionalValidEndpointUrl = (value?: string): boolean =>
  !value?.trim() || isValidEndpointUrl(value);

/**
 * Submits the toolset login form when API key fields require validation.
 *
 * `isEditMode` relaxes the OAuth `clientSecret` requirement: the server never
 * returns a previously saved secret (it's redacted on every GET), and on
 * update it preserves the stored secret when the form submits none, so an
 * existing OAuth-with-config toolset must stay saveable without forcing the
 * user to retype a secret they can't see.
 */
export const isToolsetAuthValid = (
  auth: ToolsetAuthFormData,
  isEditMode = false,
): boolean => {
  if (auth.isLoggedIn) return true;
  if (auth.authenticationType === ToolsetAuthTypes.ApiKey) {
    if (!auth.keyHeader?.trim()) return false;
    if (auth.withLogin === WithLogin.WithoutLogin) return true;
    return Boolean(auth.keyHeader?.trim() && auth.apiKey?.trim());
  }
  if (
    auth.authenticationType === ToolsetAuthTypes.OAuth &&
    auth.withLogin === WithLogin.WithConfig
  ) {
    return (
      Boolean(auth.clientId?.trim()) &&
      (isEditMode || Boolean(auth.clientSecret?.trim())) &&
      isOptionalValidEndpointUrl(auth.authorizationEndpoint) &&
      isOptionalValidEndpointUrl(auth.tokenEndpoint)
    );
  }
  return true;
};

/** Returns whether the editor form can be saved without surfacing validation errors. */
export const isToolsetFormValid = (
  form: ToolsetFormData,
  isEditMode = false,
): boolean =>
  Object.keys(validateDeploymentCreationFields(form)).length === 0 &&
  isValidEndpointUrl(form.endpoint) &&
  isToolsetAuthValid(form.auth, isEditMode);

/**
 * Extracts the reason chat-api forwarded from DIAL Core (e.g. "The specified
 * endpoint '...' is invalid or unreachable") out of a failed create/update
 * call, so the editor can show it instead of a generic "failed to save"
 * message. Returns `undefined` for anything that isn't an API error response
 * with a readable `message`, so the caller can fall back to a generic one.
 */
export const extractToolsetApiErrorMessage = async (
  error: unknown,
): Promise<string | undefined> => {
  if (!(error instanceof ResponseError)) return undefined;

  try {
    const body: unknown = await error.response.json();
    if (body == null || typeof body !== 'object') return undefined;

    const { message } = body as { message?: unknown };
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) {
      const strings = message.filter(
        (item): item is string => typeof item === 'string',
      );
      return strings.length > 0 ? strings.join(', ') : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
};
