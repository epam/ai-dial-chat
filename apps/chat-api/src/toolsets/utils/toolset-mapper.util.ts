import type { components, operations } from '@epam/ai-dial-typescript-sdk';
import { BadRequestException } from '@nestjs/common';
import type { LocalizedText } from '../../common/types/localized-text';
import {
  composeLocalizedFields,
  toLocalizedValue,
} from '../../common/utils/compose-localized-fields';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { getResourceDisplayNameFallback } from '../../common/utils/resource-name';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { HIDDEN_FILE } from '../../constants/dial.constants';
import type {
  DialToolsetAuthSettingsDto,
  DialToolsetDto,
  DialToolsetFeaturesDto,
} from '../../openapi/openapi-response.dto';
import {
  ToolsetCredentialsLevel,
  type ToolsetLoginBodyDto,
  type ToolsetLogoutBodyDto,
} from '../dto/toolset-auth.dto';
import { ToolsetAuthType } from '../dto/toolset-body.dto';
import type { ToolsetBodyDto } from '../dto/toolset-body.dto';

export const DEFAULT_TOOLSET_VERSION = '0.0.1';
export const TOOLSET_RESOURCE_PREFIX = 'toolsets/';

export type DialAuthSettings = components['schemas']['ResourceAuthSettings'];
export type DialToolsetSigninBody =
  operations['toolsetSignin']['requestBody']['content']['application/json'];
export type DialToolsetSignoutBody =
  operations['toolSetSignout']['requestBody']['content']['application/json'];
export type DialCredentialsLevel = NonNullable<
  DialToolsetSignoutBody['credentialsLevel']
>;
export type RawAuthSettings = Record<string, unknown>;

export const toDialCredentialsLevel = (
  level: ToolsetCredentialsLevel,
): DialCredentialsLevel =>
  level === ToolsetCredentialsLevel.App ? 'APPLICATION' : level;

export interface DialToolsetResource {
  bucket: string;
  path: string;
}

/*
 * DIAL Core returns two different wire shapes for a toolset depending on the
 * endpoint: the OpenAI-compatible toolset (getToolSets/getToolset) is
 * snake_case top-level, while the custom toolset resource
 * (getCustomToolSet/saveToolSet) is camelCase top-level except for
 * `allowed_tools`, which stays snake_case per that schema. Both put
 * snake_case fields inside their `auth_settings`/`authSettings` object
 * regardless of which top-level casing they use. This type carries both
 * possible casings through the merge/redaction pipeline before
 * `mapDialToolsetToDto` normalizes everything to the outgoing camelCase
 * `DialToolsetDto` shape exactly once.
 */
export interface RawDialToolset {
  id: string;
  toolset: string;
  display_name?: LocalizedText;
  displayName?: LocalizedText;
  display_version?: string;
  displayVersion?: string;
  description?: LocalizedText;
  icon_url?: string;
  iconUrl?: string;
  owner?: string;
  object?: string;
  status?: string;
  description_keywords?: string[];
  descriptionKeywords?: string[];
  reference?: string;
  max_retry_attempts?: number;
  maxRetryAttempts?: number;
  created_at?: number;
  createdAt?: number;
  updated_at?: number;
  updatedAt?: number;
  features?: unknown;
  endpoint?: string;
  transport?: string;
  allowed_tools?: string[];
  allowedTools?: string[];
  auth_settings?: RawAuthSettings;
  authSettings?: RawAuthSettings;
}

export type DialToolsetSaveBody = {
  displayName: components['schemas']['LocalizedValue'];
  displayVersion: string;
  endpoint: string;
  transport: ToolsetBodyDto['transport'];
  allowed_tools: string[];
  authSettings: DialAuthSettings;
  description?: LocalizedText;
  iconUrl?: string;
  descriptionKeywords?: string[];
  reference?: string;
};

/*
 * OAuth fields that must survive a save which doesn't resubmit them — e.g.
 * the "With Login" mode only sends { authentication_type, redirect_uri } to
 * reuse an already-configured client and reauthenticate, so every other
 * OAuth field has to be carried over from the stored config or DIAL Core
 * would receive (and likely reject) a wiped-out registration.
 */
const OAUTH_MERGEABLE_KEYS = [
  'client_id',
  'client_secret',
  'authorization_endpoint',
  'token_endpoint',
  'scopes_supported',
  'code_challenge',
  'code_challenge_method',
] as const;

export const parseDialToolsetResource = (
  toolsetName: string,
): DialToolsetResource | undefined => {
  if (!toolsetName.startsWith(TOOLSET_RESOURCE_PREFIX)) {
    return undefined;
  }

  const resource = toolsetName.slice(TOOLSET_RESOURCE_PREFIX.length);
  const [bucket, ...pathSegments] = resource.split('/');
  const path = pathSegments.join('/');
  if (!bucket || !path) {
    throw new BadRequestException('Toolset id must include bucket and path');
  }

  return { bucket, path: encodeDialResourcePath(path) };
};

export const toDialAuthSettings = (
  auth: ToolsetBodyDto['authSettings'],
): DialAuthSettings => {
  if (auth.authenticationType === ToolsetAuthType.ApiKey) {
    return {
      authentication_type: auth.authenticationType,
      ...(auth.apiKeyHeader != null
        ? { api_key_header: auth.apiKeyHeader }
        : {}),
    };
  }

  if (auth.authenticationType === ToolsetAuthType.OAuth) {
    return {
      authentication_type: auth.authenticationType,
      ...(auth.clientId != null ? { client_id: auth.clientId } : {}),
      ...(auth.clientSecret != null
        ? { client_secret: auth.clientSecret }
        : {}),
      ...(auth.authorizationEndpoint != null
        ? { authorization_endpoint: auth.authorizationEndpoint }
        : {}),
      ...(auth.tokenEndpoint != null
        ? { token_endpoint: auth.tokenEndpoint }
        : {}),
      ...(auth.scopesSupported != null
        ? { scopes_supported: auth.scopesSupported }
        : {}),
      ...(auth.redirectUri != null ? { redirect_uri: auth.redirectUri } : {}),
      ...(auth.codeChallenge != null
        ? { code_challenge: auth.codeChallenge }
        : {}),
      ...(auth.codeChallengeMethod != null
        ? { code_challenge_method: auth.codeChallengeMethod }
        : {}),
    };
  }

  return { authentication_type: auth.authenticationType };
};

export const preserveHiddenAuthSettings = (
  authSettings: DialAuthSettings,
  existingAuthSettings?: RawAuthSettings,
): DialAuthSettings => {
  const mergedAuthSettings: RawAuthSettings = { ...authSettings };

  if (
    existingAuthSettings != null &&
    authSettings.authentication_type === ToolsetAuthType.OAuth &&
    authSettings.authentication_type ===
      existingAuthSettings.authentication_type
  ) {
    for (const key of OAUTH_MERGEABLE_KEYS) {
      if (
        mergedAuthSettings[key] == null &&
        existingAuthSettings[key] != null
      ) {
        mergedAuthSettings[key] = existingAuthSettings[key];
      }
    }
  }

  return mergedAuthSettings as DialAuthSettings;
};

/*
 * Maps the request DTO to the body DIAL Core's ToolSet schema expects:
 * camelCase top-level fields (allowed_tools stays snake_case per that
 * schema), with authSettings itself holding snake_case fields, only
 * including auth fields relevant to the selected authentication type.
 */
export const toDialToolsetBody = (
  body: ToolsetBodyDto,
  version: string,
  existingAuthSettings?: RawAuthSettings,
): DialToolsetSaveBody => {
  const authSettings = preserveHiddenAuthSettings(
    toDialAuthSettings(body.authSettings),
    existingAuthSettings,
  );
  const { displayName, description } = composeLocalizedFields(
    body.name,
    body.description,
    body.locales,
    body.primaryLocale,
  );
  const dialBody: DialToolsetSaveBody = {
    displayName: toLocalizedValue(displayName),
    displayVersion: version,
    endpoint: body.endpoint.trim(),
    transport: body.transport,
    allowed_tools: body.allowedTools ?? [],
    authSettings,
  };
  if (description != null) dialBody.description = description;
  if (body.iconUrl != null) dialBody.iconUrl = body.iconUrl;
  if (body.topics != null) dialBody.descriptionKeywords = body.topics;
  if (body.reference != null) dialBody.reference = body.reference;
  return dialBody;
};

/*
 * Unlike the path-based endpoints (get/update/delete), DIAL Core's signin
 * body `url` field is never implicitly percent-decoded by an HTTP routing
 * layer before DIAL Core encodes it internally to match its stored resource
 * key — so an already percent-encoded value here ends up encoded twice on
 * DIAL Core's side. Sending the raw (decoded) resource reference instead
 * lets DIAL Core apply that one encoding step itself, matching the same
 * single-encoded key path-based lookups arrive at.
 */
export const resolveToolsetLoginUrl = (toolsetName: string): string => {
  const resource = parseDialToolsetResource(toolsetName);
  if (!resource) {
    throw new BadRequestException('Toolset id must include bucket and path');
  }
  return `${TOOLSET_RESOURCE_PREFIX}${resource.bucket}/${safeDecodeURIComponent(resource.path)}`;
};

export const toDialToolsetSigninBody = (
  body: ToolsetLoginBodyDto,
  toolsetName: string,
): DialToolsetSigninBody => {
  const base = {
    url: resolveToolsetLoginUrl(toolsetName),
    credentialsLevel: toDialCredentialsLevel(body.credentialsLevel),
  };

  if (body.authenticationType === ToolsetAuthType.ApiKey) {
    return {
      ...base,
      authenticationType: ToolsetAuthType.ApiKey,
      apiKey: body.apiKey,
    };
  }

  if (body.authenticationType === ToolsetAuthType.OAuth) {
    return {
      ...base,
      authenticationType: ToolsetAuthType.OAuth,
      code: body.code,
      redirectUri: body.redirectUri,
    };
  }

  throw new BadRequestException('Unsupported toolset authentication type');
};

export const toDialToolsetSignoutBody = (
  body: ToolsetLogoutBodyDto,
  authenticationType: string | undefined,
  toolsetName: string,
): DialToolsetSignoutBody => {
  if (
    authenticationType !== ToolsetAuthType.ApiKey &&
    authenticationType !== ToolsetAuthType.OAuth
  ) {
    throw new BadRequestException('Unsupported toolset authentication type');
  }

  return {
    url: resolveToolsetLoginUrl(toolsetName),
    credentialsLevel: toDialCredentialsLevel(body.credentialsLevel),
    authenticationType,
  };
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

export const getString = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
};

export const getBoolean = (
  record: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
};

export const getStringArray = (
  record: Record<string, unknown>,
  key: string,
): string[] | undefined => {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
};

export const isVisibleToolset = (toolset: RawDialToolset): boolean =>
  Boolean(toolset.id) && !toolset.id.includes(HIDDEN_FILE);

/*
 * Resolves whichever raw auth settings container the source endpoint used
 * (`authSettings` for the custom toolset resource, `auth_settings` for the
 * OpenAI-compatible toolset) without yet converting its nested fields —
 * used by the pre-mapping merge step, which needs to combine partial raw
 * dicts from two sources before the single final camelCase conversion.
 */
export const getRawAuthSettings = (
  toolset?: RawDialToolset,
): RawAuthSettings | undefined => {
  const settings = toolset?.authSettings ?? toolset?.auth_settings;
  return isRecord(settings) ? settings : undefined;
};

/*
 * Never reads client_secret/code_verifier — the allowlist of fields copied
 * here doubles as the secret redaction, so a raw payload carrying those
 * fields (as sent to DIAL Core) never reaches the response.
 */
export const mapAuthSettings = (
  raw?: RawAuthSettings,
): DialToolsetAuthSettingsDto | undefined => {
  if (!isRecord(raw)) return undefined;
  const authenticationType = getString(raw, 'authentication_type');
  if (authenticationType == null) return undefined;

  return {
    authenticationType,
    dynamicallyRegistered: getBoolean(raw, 'dynamically_registered'),
    apiKeyHeader: getString(raw, 'api_key_header'),
    clientId: getString(raw, 'client_id'),
    redirectUri: getString(raw, 'redirect_uri'),
    authorizationEndpoint: getString(raw, 'authorization_endpoint'),
    tokenEndpoint: getString(raw, 'token_endpoint'),
    codeChallenge: getString(raw, 'code_challenge'),
    codeChallengeMethod: getString(raw, 'code_challenge_method'),
    scopesSupported: getStringArray(raw, 'scopes_supported'),
    globalAuthStatus: getString(raw, 'global_auth_status'),
    userLevelAuthStatus: getString(raw, 'user_level_auth_status'),
  };
};

export const mapToolsetFeatures = (
  raw: unknown,
): DialToolsetFeaturesDto | undefined => {
  if (!isRecord(raw)) return undefined;

  return {
    rate: getBoolean(raw, 'rate'),
    tokenize: getBoolean(raw, 'tokenize'),
    truncatePrompt: getBoolean(raw, 'truncate_prompt'),
    configuration: getBoolean(raw, 'configuration'),
    systemPrompt: getBoolean(raw, 'system_prompt'),
    tools: getBoolean(raw, 'tools'),
    seed: getBoolean(raw, 'seed'),
    urlAttachments: getBoolean(raw, 'url_attachments'),
    folderAttachments: getBoolean(raw, 'folder_attachments'),
    allowResume: getBoolean(raw, 'allow_resume'),
    accessibleByPerRequestKey: getBoolean(raw, 'accessible_by_per_request_key'),
    contentParts: getBoolean(raw, 'content_parts'),
    temperature: getBoolean(raw, 'temperature'),
    cache: getBoolean(raw, 'cache'),
    autoCaching: getBoolean(raw, 'auto_caching'),
    parallelToolCalls: getBoolean(raw, 'parallel_tool_calls'),
    assistantAttachmentsInRequest: getBoolean(
      raw,
      'assistant_attachments_in_request',
    ),
    mcp: getBoolean(raw, 'mcp'),
    chatCompletion: getBoolean(raw, 'chat_completion'),
    responsesApi: getBoolean(raw, 'responses_api'),
    maxTokensSupported: getBoolean(raw, 'max_tokens_supported'),
    maxCompletionTokensSupported: getBoolean(
      raw,
      'max_completion_tokens_supported',
    ),
    customTemperatureSupported: getBoolean(raw, 'custom_temperature_supported'),
    reasoningEfforts: getStringArray(raw, 'reasoning_efforts'),
  };
};

/*
 * Single point where every raw DIAL Core toolset field (whichever casing
 * the source endpoint used) is converted into the outgoing camelCase
 * `DialToolsetDto` shape, mirroring `deployments`' `mapToDeploymentItem`.
 * Applied exactly once, after any raw-level merging (`mergeCustomToolsetDetails`)
 * is done.
 */
export const mapDialToolsetToDto = (raw: RawDialToolset): DialToolsetDto => ({
  id: raw.id,
  toolset: raw.toolset,
  displayName:
    raw.displayName ??
    raw.display_name ??
    getResourceDisplayNameFallback(raw.id),
  displayVersion: raw.displayVersion ?? raw.display_version,
  description: raw.description,
  iconUrl: raw.iconUrl ?? raw.icon_url,
  owner: raw.owner,
  object: raw.object,
  status: raw.status,
  descriptionKeywords: raw.descriptionKeywords ?? raw.description_keywords,
  reference: raw.reference,
  maxRetryAttempts: raw.maxRetryAttempts ?? raw.max_retry_attempts,
  createdAt: raw.createdAt ?? raw.created_at,
  updatedAt: raw.updatedAt ?? raw.updated_at,
  features: mapToolsetFeatures(raw.features),
  endpoint: raw.endpoint,
  transport: raw.transport,
  allowedTools: raw.allowedTools ?? raw.allowed_tools,
  authSettings: mapAuthSettings(getRawAuthSettings(raw)),
});

export const mergeCustomToolsetDetails = (
  customToolset: RawDialToolset,
  toolsetName: string,
  extendedToolset?: RawDialToolset,
): RawDialToolset => {
  const mergedAuthSettings = {
    ...(getRawAuthSettings(extendedToolset) ?? {}),
    ...(getRawAuthSettings(customToolset) ?? {}),
  };
  const mergedToolset: RawDialToolset = {
    ...(extendedToolset ?? {}),
    ...customToolset,
    id: customToolset.id ?? extendedToolset?.id ?? toolsetName,
    toolset: customToolset.toolset ?? extendedToolset?.toolset ?? toolsetName,
    object: customToolset.object ?? extendedToolset?.object ?? 'toolset',
  };

  delete mergedToolset.authSettings;
  delete mergedToolset.auth_settings;

  if (Object.keys(mergedAuthSettings).length > 0) {
    mergedToolset.auth_settings = mergedAuthSettings;
  }

  return mergedToolset;
};
