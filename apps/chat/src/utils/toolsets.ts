import type { DialToolsetDto, ToolsetBodyDto } from '@epam/chat-api-client';
import {
  DEFAULT_TOOLSET_NAME,
  DEFAULT_TOOLSET_VERSION,
  TOOLSET_REDIRECT_STATE_KEY,
} from '../constants/toolsets';
import { ROUTES } from '../types/routes';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
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

export const buildToolsetAuthorizeUrl = (
  auth: ToolsetAuthFormData,
  redirectUri: string,
): { url: string; state: string } | null => {
  if (!auth.authorizationEndpoint?.trim() || !auth.clientId?.trim()) {
    return null;
  }
  try {
    const url = new URL(auth.authorizationEndpoint.trim());
    const state = crypto.randomUUID();
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', auth.clientId.trim());
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    if (auth.scopes && auth.scopes.length > 0) {
      url.searchParams.set('scope', auth.scopes.join(' '));
    }
    return { url: url.toString(), state };
  } catch {
    return null;
  }
};

/**
 * Builds the OAuth authorize URL, persists the redirect state to
 * `sessionStorage`, and navigates to the provider. Shared by the post-save
 * auto-login flow and the manual Log In action so both trigger points stay
 * in sync. Returns `false` (without navigating) when the auth config is
 * invalid.
 */
export const initiateOAuthLogin = (
  auth: ToolsetAuthFormData,
  toolsetId: string,
  callbackUrl: string,
): boolean => {
  const redirectUri = `${window.location.origin}${ROUTES.ToolsetEditorCallback}`;
  const result = buildToolsetAuthorizeUrl(auth, redirectUri);
  if (!result) return false;

  const redirectState: ToolsetRedirectState = {
    toolsetId,
    credentialsLevel: ToolsetCredentialsLevel.User,
    callbackUrl,
    state: result.state,
  };
  sessionStorage.setItem(
    TOOLSET_REDIRECT_STATE_KEY,
    JSON.stringify(redirectState),
  );
  window.location.href = result.url;
  return true;
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
    intro: '',
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
