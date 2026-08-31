import type {
  DialToolsetDto,
  ToolsetBodyDto,
} from '@epam/ai-dial-chat-api-client';
import { ResponseError } from '@epam/ai-dial-chat-api-client';
import {
  composeLocalePayload,
  decomposeLocalizedFields,
  getToolsetRedirectUri as resolveOAuthRedirectUri,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
import { validateDeploymentCreationFields } from '@epam/ai-dial-deployment-creation-form';
import {
  DEFAULT_TOOLSET_NAME,
  DEFAULT_TOOLSET_VERSION,
  ToolsetTransportType,
} from '../constants/toolsets';
import type { ToolsetAuthFormData, ToolsetFormData } from '../models/toolsets';
import { getToolset } from '../server-api/toolsets';
import { ROUTES } from '../types/routes';
import { PRIMARY_LOCALE, resolveLocalizedText } from './locale';

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
  otherLocales: [],
  endpoint: '',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: getDefaultAuthFormData(),
});

const isSignedIn = (status?: string): boolean =>
  status === ToolsetAuthStatus.SignedIn;

/** App-level wrapper binding the lib's callback-path parameter to this app's own route. */
export const getToolsetRedirectUri = (): string =>
  resolveOAuthRedirectUri(ROUTES.ToolsetSignIn);

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

/** Maps a loaded toolset DTO's `authSettings` (snake_case) into auth form state. */
const authSettingsDtoToForm = (
  authSettings: DialToolsetDto['authSettings'],
): ToolsetAuthFormData => {
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
  };
};

/** Maps a loaded toolset DTO (snake_case) into editor form state. */
export const toolsetDtoToForm = (dto: DialToolsetDto): ToolsetFormData => ({
  name: resolveLocalizedText(dto.displayName, PRIMARY_LOCALE),
  version: dto.displayVersion ?? DEFAULT_TOOLSET_VERSION,
  iconUrl: dto.iconUrl ?? '',
  description: resolveLocalizedText(dto.description, PRIMARY_LOCALE),
  topics: dto.descriptionKeywords ?? [],
  otherLocales: decomposeLocalizedFields(
    dto.displayName,
    dto.description,
    PRIMARY_LOCALE,
  ),
  endpoint: normalizeReturnedEndpointUrl(dto.endpoint),
  protocol:
    (dto.transport as ToolsetTransportType) ?? ToolsetTransportType.Http,
  allowedTools: dto.allowedTools ?? [],
  reference: dto.reference,
  auth: authSettingsDtoToForm(dto.authSettings),
});

/**
 * Fetches a toolset by id and maps its stored `authSettings` into an auth
 * form-state patch, reusing `authSettingsDtoToForm`'s mapping directly rather
 * than building and discarding a full `ToolsetFormData`. Shared by the OAuth
 * `Cancelled`-result reconciliation and the dynamic-client-registration login
 * path, both of which need the server's current auth config rather than
 * stale pre-save form state.
 */
export const fetchToolsetAuthSettings = async (
  toolsetId: string,
): Promise<ToolsetAuthFormData> => {
  const dto = await getToolset(toolsetId);
  return authSettingsDtoToForm(dto.authSettings);
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

  const locales = composeLocalePayload(form.otherLocales, PRIMARY_LOCALE);

  return {
    name: form.name.trim(),
    version: form.version.trim() || DEFAULT_TOOLSET_VERSION,
    description: form.description.trim() || undefined,
    iconUrl: form.iconUrl.trim() || undefined,
    topics: form.topics.length > 0 ? form.topics : undefined,
    endpoint: normalizeReturnedEndpointUrl(form.endpoint),
    transport: form.protocol,
    allowedTools: form.allowedTools.length > 0 ? form.allowedTools : undefined,
    reference: form.reference,
    authSettings,
    locales,
    primaryLocale: locales ? PRIMARY_LOCALE : undefined,
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
