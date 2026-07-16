import { validateDeploymentCreationFields } from '@epam/ai-dial-deployment-creation-form';
import type { DialToolsetDto, ToolsetBodyDto } from '@epam/chat-api-client';
import { ResponseError } from '@epam/chat-api-client';
import {
  DEFAULT_TOOLSET_NAME,
  DEFAULT_TOOLSET_VERSION,
  TOOLSET_REDIRECT_STATE_KEY,
} from '../constants/toolsets';
import { ROUTES } from '../types/routes';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetOAuthChannelMessage,
  ToolsetOAuthInitiationResult,
  ToolsetOAuthResult,
  ToolsetPopupState,
  ToolsetRedirectState,
} from '../types/toolsets';
import {
  ToolsetAuthStatus,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
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
 * Builds the OAuth authorize URL for a given, already-generated `state`
 * value. The caller owns what `state` carries — see `initiateOAuthLogin` for
 * the admin flow and `design.md` D2 for the QuickApps popup flow.
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
 * Builds the OAuth authorize URL, opens a same-origin popup synchronously (so
 * a blocked popup can be reliably detected), writes the redirect state into
 * *that popup's own* `sessionStorage` while it is still same-origin
 * `about:blank`, then navigates it to the provider's authorization page.
 * Writing into the popup's own storage (rather than the opener's) is what
 * makes the redirect state reliably readable by the callback route once the
 * provider redirects back into that same popup — the two browsing contexts
 * do not share a `sessionStorage` partition. Shared by the post-save
 * auto-login flow (Editor, always `USER`) and the manual Log In action
 * (Editor or Catalog, `USER` or `GLOBAL`) so all trigger points stay in sync.
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

const TOOLSET_OAUTH_CHANNEL_PREFIX = 'toolset-oauth-';

/** Name of the same-origin `BroadcastChannel` shared by an OAuth flow's opener and its callback popup. */
export const getToolsetOAuthChannelName = (flowId: string): string =>
  `${TOOLSET_OAUTH_CHANNEL_PREFIX}${flowId}`;

const DEFAULT_OAUTH_RESULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_OAUTH_POPUP_POLL_INTERVAL_MS = 500;
const DEFAULT_OAUTH_CLOSE_GRACE_MS = 300;

/**
 * Waits for the OAuth callback popup to report a result over the flow's
 * `BroadcastChannel`, resolving with `Cancelled` if the popup is closed
 * manually or no result arrives before the timeout elapses.
 *
 * The callback popup posts its result and calls `window.close()` back to
 * back, so the popup can finish closing before the browser has flushed that
 * `BroadcastChannel` message to this tab. Detecting `popup.closed` is
 * therefore not proof a result was never posted — `closeGraceMs` gives an
 * in-flight message a short window to still arrive before giving up.
 */
export const waitForToolsetOAuthResult = (
  popup: Window,
  flowId: string,
  {
    timeoutMs = DEFAULT_OAUTH_RESULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_OAUTH_POPUP_POLL_INTERVAL_MS,
    closeGraceMs = DEFAULT_OAUTH_CLOSE_GRACE_MS,
  }: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    closeGraceMs?: number;
  } = {},
): Promise<ToolsetOAuthResult> =>
  new Promise((resolve) => {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    let settled = false;
    let closeGraceTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = (outcome: ToolsetOAuthResult) => {
      if (settled) return;
      settled = true;
      clearInterval(pollId);
      clearTimeout(timeoutId);
      if (closeGraceTimeoutId != null) clearTimeout(closeGraceTimeoutId);
      channel.close();
      resolve(outcome);
    };

    channel.onmessage = (event: MessageEvent<ToolsetOAuthChannelMessage>) => {
      finish(event.data);
    };

    const pollId = setInterval(() => {
      if (popup.closed && closeGraceTimeoutId == null) {
        closeGraceTimeoutId = setTimeout(
          () => finish({ type: ToolsetOAuthResultType.Cancelled }),
          closeGraceMs,
        );
      }
    }, pollIntervalMs);

    const timeoutId = setTimeout(() => {
      popup.close();
      finish({ type: ToolsetOAuthResultType.Cancelled });
    }, timeoutMs);
  });

const TOOLSETS_ID_PREFIX = 'toolsets/';
const PUBLIC_BUCKET_SEGMENT = 'public';

/** Whether a toolset id belongs to the `public` bucket (shared with all users), mirroring the legacy `isEntityIdPublic` check. */
export const isPublicToolsetId = (toolsetId: string): boolean => {
  if (!toolsetId.startsWith(TOOLSETS_ID_PREFIX)) return false;
  const bucket = toolsetId.slice(TOOLSETS_ID_PREFIX.length).split('/')[0];
  return bucket === PUBLIC_BUCKET_SEGMENT;
};

/** Returns whether `origin` is a well-formed absolute URL origin (never `'*'`). */
export const isValidPostMessageOrigin = (origin: string): boolean => {
  try {
    return new URL(origin).origin === origin;
  } catch {
    return false;
  }
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

/** Reverses the sender's base64url encoding (`-`→`+`, `_`→`/`, re-padded). Throws on malformed input — caller catches. */
const decodeBase64Url = (value: string): string => {
  const b64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return new TextDecoder().decode(
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
  );
};

const isValidCredentialsLevel = (
  value: unknown,
): value is ToolsetCredentialsLevel =>
  value === ToolsetCredentialsLevel.Global ||
  value === ToolsetCredentialsLevel.User;

/**
 * Decodes and strictly validates the base64url-encoded JSON `state` payload
 * used by the popup-based toolset login handshake (see design.md D2). Returns
 * `null` on any parse failure or missing/invalid field so the caller never
 * falls back to an unsafe default for `originatingOrigin`.
 */
export const decodeToolsetPopupState = (
  state: string,
): ToolsetPopupState | null => {
  try {
    const parsed = JSON.parse(
      decodeBase64Url(state),
    ) as Partial<ToolsetPopupState>;
    if (
      typeof parsed.toolsetId !== 'string' ||
      !parsed.toolsetId ||
      typeof parsed.originatingOrigin !== 'string' ||
      !parsed.originatingOrigin ||
      !isValidPostMessageOrigin(parsed.originatingOrigin) ||
      typeof parsed.nonce !== 'string' ||
      !parsed.nonce ||
      !isValidCredentialsLevel(parsed.credentialsLevel)
    ) {
      return null;
    }
    return parsed as ToolsetPopupState;
  } catch {
    return null;
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
    authSettings?.clientId
  ) {
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
