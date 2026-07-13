import type { DialToolsetDto, ToolsetBodyDto } from '@epam/chat-api-client';
import {
  DEFAULT_TOOLSET_NAME,
  DEFAULT_TOOLSET_VERSION,
} from '../constants/toolsets';
import { ROUTES } from '../types/routes';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetPopupState,
  ToolsetRedirectState,
} from '../types/toolsets';
import {
  ToolsetAuthStatus,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
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
 * Builds the OAuth authorize URL for a given, already-encoded `state` value.
 * The caller owns what `state` carries — see `encodeToolsetRedirectState` for
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

/**
 * Builds the OAuth authorize URL and opens the provider in a new browser
 * window/tab (rather than navigating the current page away), so the current
 * page stays put. Shared by the post-save auto-login flow (Editor, always
 * `USER`) and the manual Log In action (Editor or Catalog, `USER` or
 * `GLOBAL`) so all trigger points stay in sync. Returns `false` (without
 * opening a window) when the auth config is invalid or the popup was
 * blocked.
 *
 * The redirect state (`toolsetId`, `credentialsLevel`) is encoded into the
 * OAuth `state` query parameter rather than persisted to `sessionStorage`:
 * the window opened below uses `noopener`, which severs `sessionStorage`
 * sharing with it, so anything stashed in this tab's `sessionStorage` would
 * never be readable from the callback route running in that window.
 */
export const initiateOAuthLogin = (
  auth: ToolsetAuthFormData,
  toolsetId: string,
  credentialsLevel: ToolsetCredentialsLevel = ToolsetCredentialsLevel.User,
): boolean => {
  const redirectUri = `${window.location.origin}${ROUTES.ToolsetEditorCallback}`;
  const state = encodeToolsetRedirectState({
    toolsetId,
    credentialsLevel,
    csrfToken: crypto.randomUUID(),
  });
  const url = buildToolsetAuthorizeUrl(auth, redirectUri, state);
  if (!url) return false;

  /*
   * `noopener` (not a post-hoc `authWindow.opener = null`) is required to
   * actually sever the opener reference for a cross-origin popup — setting
   * `.opener` after `window.open` is a no-op once navigation has started.
   * With `noopener`, some browsers return `null` even though the tab opened,
   * so a `null` result here is treated as success rather than popup-blocked.
   */
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};

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

/** Base64url-encodes a UTF-8 string (`+`→`-`, `/`→`_`, no `=` padding). */
const encodeBase64Url = (value: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Reverses `encodeBase64Url`. Throws on malformed input — caller catches. */
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

/**
 * Encodes the admin flow's redirect state as the base64url-encoded JSON that
 * travels in the OAuth `state` query parameter (see `initiateOAuthLogin`).
 */
export const encodeToolsetRedirectState = (
  redirectState: ToolsetRedirectState,
): string => encodeBase64Url(JSON.stringify(redirectState));

/**
 * Decodes and strictly validates the admin flow's `state` payload. Returns
 * `null` on any parse failure or missing/invalid field.
 */
export const decodeToolsetRedirectState = (
  state: string,
): ToolsetRedirectState | null => {
  try {
    const parsed = JSON.parse(
      decodeBase64Url(state),
    ) as Partial<ToolsetRedirectState>;
    if (
      typeof parsed.toolsetId !== 'string' ||
      !parsed.toolsetId ||
      typeof parsed.csrfToken !== 'string' ||
      !parsed.csrfToken ||
      !isValidCredentialsLevel(parsed.credentialsLevel)
    ) {
      return null;
    }
    return parsed as ToolsetRedirectState;
  } catch {
    return null;
  }
};

/** Maps a loaded toolset DTO (snake_case) into editor form state. */
export const toolsetDtoToForm = (dto: DialToolsetDto): ToolsetFormData => {
  const authSettings = dto.authSettings;
  const authenticationType =
    (authSettings?.authenticationType as ToolsetAuthTypes) ??
    ToolsetAuthTypes.None;
  const isLoggedIn =
    isSignedIn(authSettings?.userLevelAuthStatus) ||
    isSignedIn(authSettings?.globalAuthStatus);

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
    endpoint: dto.endpoint ?? '',
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
      authorizationEndpoint: authSettings?.authorizationEndpoint ?? '',
      tokenEndpoint: authSettings?.tokenEndpoint ?? '',
      scopes: authSettings?.scopesSupported ?? [],
    },
  };
};

/** Maps editor form state into the create/update request body. */
export const formToToolsetBody = (form: ToolsetFormData): ToolsetBodyDto => {
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
      auth.authorizationEndpoint?.trim() || undefined;
    authSettings.tokenEndpoint = auth.tokenEndpoint?.trim() || undefined;
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
    endpoint: form.endpoint.trim(),
    transport: form.protocol,
    allowedTools: form.allowedTools.length > 0 ? form.allowedTools : undefined,
    reference: form.reference,
    authSettings,
  };
};

/** Validates a toolset endpoint URL (http(s) or sse, parseable, no trailing `.`/`//`). */
export const isValidEndpointUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!/^(https?|sse):\/\//.test(trimmed)) return false;
  if (trimmed.endsWith('.') || trimmed.endsWith('//')) return false;
  try {
    return Boolean(new URL(trimmed));
  } catch {
    return false;
  }
};

/** Submits the toolset login form when API key fields require validation. */
export const isToolsetAuthValid = (auth: ToolsetAuthFormData): boolean => {
  if (auth.isLoggedIn) return true;
  if (auth.authenticationType === ToolsetAuthTypes.ApiKey) {
    if (auth.withLogin === WithLogin.WithoutLogin) return true;
    return Boolean(auth.keyHeader?.trim() && auth.apiKey?.trim());
  }
  if (
    auth.authenticationType === ToolsetAuthTypes.OAuth &&
    auth.withLogin === WithLogin.WithConfig
  ) {
    return Boolean(auth.clientId?.trim()) && Boolean(auth.clientSecret?.trim());
  }
  return true;
};
