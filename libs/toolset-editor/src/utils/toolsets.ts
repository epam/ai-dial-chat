import { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import { validateDeploymentCreationFields } from '@epam/ai-dial-builder-form';
import {
  DEFAULT_TOOLSET_NAME,
  DEFAULT_TOOLSET_VERSION,
  ToolsetTransportType,
} from '../constants/toolsets';
import type { ToolsetAuthFormData, ToolsetFormData } from '../models/toolset-form';

/**
 * Returns a storage-safe toolset name that does not collide with any existing
 * name, appending a numeric suffix when the default name is taken.
 */
export const getStorageSafeUniqueToolsetName = ({
  defaultName = DEFAULT_TOOLSET_NAME,
  existingNames,
}: {
  /** Candidate name to make unique. Defaults to `DEFAULT_TOOLSET_NAME`. */
  defaultName?: string;
  /** Names already taken by the user's toolsets. */
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

/** Returns the form state a brand-new toolset editor opens with. */
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

/**
 * Normalizes an endpoint URL as returned by the backend: repairs a
 * single-slash scheme (`https:/\/…`) and decodes percent-encoding when either
 * produces a valid URL; otherwise returns the trimmed value unchanged.
 */
export const normalizeReturnedEndpointUrl = (value?: string): string => {
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

const isOptionalValidEndpointUrl = (value?: string): boolean =>
  !value?.trim() || isValidEndpointUrl(value);

/**
 * Returns whether the auth form state can be saved without surfacing
 * validation errors. `isEditMode` relaxes the OAuth `clientSecret`
 * requirement: the server never returns a previously saved secret (it's
 * redacted on every GET), and on update it preserves the stored secret when
 * the form submits none, so an existing OAuth-with-config toolset must stay
 * saveable without forcing the user to retype a secret they can't see.
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
  Object.keys(
    validateDeploymentCreationFields(form, { validateVersionPattern: true }),
  ).length === 0 &&
  isValidEndpointUrl(form.endpoint) &&
  isToolsetAuthValid(form.auth, isEditMode);
