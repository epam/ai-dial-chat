import { getResourceDisplayNameFallback } from '../../common/utils/resource-name';
import { getVersionGroupId } from '../../common/utils/version-group';
import type {
  DeploymentFeaturesDetailsDto,
  ModelCatalogPropertiesDto,
  ToolsetAuthSettingsDto,
} from '../dto/deployment-details.dto';
import {
  DeploymentItemType,
  type DeploymentModelKindsDto,
  ConversationStartersDto,
  DeploymentItemDto,
} from '../dto/deployment-item.dto';
import { RawDeploymentDto } from '../dto/raw-deployment.dto';
import { hasHiddenEntityTag } from './hidden-entity-tags.util';

export const isRecord = (val: unknown): val is Record<string, unknown> =>
  val != null && typeof val === 'object' && !Array.isArray(val);

export const toAdditionalProperties = (
  val: unknown,
): boolean | Record<string, unknown> | undefined => {
  if (typeof val === 'boolean') return val;
  if (isRecord(val)) return val;
  return undefined;
};

export const getBoolean = (
  record: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
};

export const getNumber = (
  record: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
};

export const getString = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
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

enum DeploymentApiInterface {
  ChatCompletions = 'openaiChatCompletions',
  Embeddings = 'openaiEmbeddings',
  Responses = 'openaiResponses',
  Messages = 'anthropicMessages',
}

const API_INTERFACES = Object.values(DeploymentApiInterface);

/** Returns canonical declared API names, or undefined when declaration metadata is unavailable. */
export const mapDeclaredInterfaces = (raw: unknown): string[] | undefined => {
  if (!isRecord(raw)) return undefined;
  const configs = raw.interface_configs;
  if (isRecord(configs)) {
    return API_INTERFACES.filter(
      (name) => Object.hasOwn(configs, name) && isRecord(configs[name]),
    );
  }
  const interfaces = raw.interfaces;
  if (!Array.isArray(interfaces)) return undefined;
  const declared = API_INTERFACES.filter((name) => interfaces.includes(name));
  const isRecognizedOrEmpty = declared.length > 0 || interfaces.length === 0;
  return isRecognizedOrEmpty ? declared : undefined;
};

/** Returns normalized advertised APIs, with legacy OpenAI fallback when declarations are unavailable. */
export const mapSupportedInterfaces = (raw: unknown): string[] | undefined => {
  const declared = mapDeclaredInterfaces(raw);
  if (declared != null) return declared;
  if (!isRecord(raw) || !isRecord(raw.features)) return undefined;
  const hasChatCompletion = getBoolean(raw.features, 'chat_completion');
  const hasResponsesApi = getBoolean(raw.features, 'responses_api');
  if (hasChatCompletion == null && hasResponsesApi == null) return undefined;
  const supported: string[] = [];
  if (hasChatCompletion) supported.push(DeploymentApiInterface.ChatCompletions);
  if (hasResponsesApi) supported.push(DeploymentApiInterface.Responses);
  return supported;
};

export const mapConversationStarters = (
  raw: unknown,
): ConversationStartersDto | undefined => {
  if (!isRecord(raw) || !Array.isArray(raw.starters)) return undefined;

  const starters = raw.starters
    .filter(isRecord)
    .map((starter) => {
      const title = getString(starter, 'title')?.trim();
      const text = getString(starter, 'text')?.trim();
      return title && text ? { title, text } : undefined;
    })
    .filter((starter): starter is { title: string; text: string } =>
      Boolean(starter),
    );

  if (starters.length === 0) return undefined;

  const introText = getString(raw, 'intro_text');
  const autoSubmit = getBoolean(raw, 'auto_submit');
  const chatMessageInputDisabled = getBoolean(
    raw,
    'chat_message_input_disabled',
  );

  return {
    ...(introText != null && { introText }),
    ...(autoSubmit != null && { autoSubmit }),
    ...(chatMessageInputDisabled != null && { chatMessageInputDisabled }),
    starters,
  };
};

/**
 * DIAL Core's `auth_settings` payload carries more fields than the SDK's
 * `ResourceAuthSettingsData` type declares (e.g. `token_endpoint`,
 * `token_endpoint_auth_method`), so this reads defensively off the raw
 * object, mirroring `mapDeploymentFeatures`. `client_secret`/`code_verifier`
 * are never read, even if present on the raw payload — those are the only
 * fields excluded per the non-goal of never exposing OAuth client secrets.
 */
export const mapToolsetAuthSettings = (
  raw: unknown,
): ToolsetAuthSettingsDto | undefined => {
  if (!isRecord(raw)) return undefined;

  return {
    authenticationType: getString(raw, 'authentication_type'),
    dynamicallyRegistered: getBoolean(raw, 'dynamically_registered'),
    globalAuthStatus: getString(raw, 'global_auth_status'),
    appLevelAuthStatus: getString(raw, 'app_level_auth_status'),
    userLevelAuthStatus: getString(raw, 'user_level_auth_status'),
    scopesSupported: getStringArray(raw, 'scopes_supported'),
    authorizationEndpoint: getString(raw, 'authorization_endpoint'),
    tokenEndpoint: getString(raw, 'token_endpoint'),
    apiKeyHeader: getString(raw, 'api_key_header'),
    clientId: getString(raw, 'client_id'),
    clientSecretHint: getString(raw, 'client_secret_hint'),
    redirectUri: getString(raw, 'redirect_uri'),
    tokenEndpointAuthMethod: getString(raw, 'token_endpoint_auth_method'),
    codeChallenge: getString(raw, 'code_challenge'),
    codeChallengeMethod: getString(raw, 'code_challenge_method'),
  };
};

/**
 * Redacts `auth_settings.client_secret`/`code_verifier` before logging a
 * raw DIAL Core toolset response — those must never appear in logs, even at
 * debug level.
 */
export const redactToolsetAuthSettings = (raw: unknown): unknown => {
  if (!isRecord(raw) || !isRecord(raw.auth_settings)) return raw;

  const { client_secret, code_verifier, ...safeAuthSettings } =
    raw.auth_settings;
  void client_secret;
  void code_verifier;

  return { ...raw, auth_settings: safeAuthSettings };
};

/**
 * Redacts `function.env` before logging a raw DIAL Core application
 * response — function environment variables can hold secrets and must never
 * appear in logs, even at debug level.
 */
export const redactApplicationFunctionEnv = (raw: unknown): unknown => {
  if (!isRecord(raw) || !isRecord(raw.function) || !('env' in raw.function)) {
    return raw;
  }

  const { env, ...safeFunction } = raw.function;
  void env;

  return { ...raw, function: safeFunction };
};

/**
 * DIAL Core's runtime `features` payload includes more flags than the
 * `DeploymentFeatures` SDK type declares (e.g. chat_completion, responses_api,
 * reasoning_efforts), so this reads defensively off the raw object instead of
 * the typed SDK shape.
 */
/**
 * The configured model type from Core's `capabilities`: only the three kinds
 * the catalog reads, each only when Core sent a boolean. Undefined when none is
 * present, so a model without them carries no `modelKinds` at all.
 */
const mapModelKinds = (
  capabilities: unknown,
): DeploymentModelKindsDto | undefined => {
  if (!isRecord(capabilities)) return undefined;
  const kinds: DeploymentModelKindsDto = {
    ...(typeof capabilities.chat_completion === 'boolean' && {
      chatCompletion: capabilities.chat_completion,
    }),
    ...(typeof capabilities.completion === 'boolean' && {
      completion: capabilities.completion,
    }),
    ...(typeof capabilities.embeddings === 'boolean' && {
      embeddings: capabilities.embeddings,
    }),
  };
  return Object.keys(kinds).length > 0 ? kinds : undefined;
};

/**
 * Allow-lists `catalog_properties` (schema-driven, identical shape across
 * model/application/toolset DIAL Core responses) to the four recognized
 * string fields shown in the catalog Overview panel. Unknown keys and
 * non-string values are dropped; the result is omitted entirely rather than
 * returned as an empty object when nothing recognized remains.
 */
export const mapCatalogProperties = (
  raw: unknown,
): ModelCatalogPropertiesDto | undefined => {
  if (!isRecord(raw)) return undefined;

  const properties = {
    vendor: getString(raw, 'vendor'),
    license: getString(raw, 'license'),
    knowledgeCutoffDate: getString(raw, 'knowledgeCutoffDate'),
    parameters: getString(raw, 'parameters'),
  };

  return Object.values(properties).some((value) => value != null)
    ? properties
    : undefined;
};

export const mapDeploymentFeatures = (
  raw: unknown,
  declaredInterfaces?: readonly string[],
): DeploymentFeaturesDetailsDto | undefined => {
  if (!isRecord(raw) && declaredInterfaces == null) return undefined;
  const features: Record<string, unknown> = isRecord(raw) ? raw : {};

  const reasoningEfforts = Array.isArray(features.reasoning_efforts)
    ? features.reasoning_efforts.filter(
        (effort): effort is string => typeof effort === 'string',
      )
    : undefined;

  return {
    rate: getBoolean(features, 'rate'),
    mcp: getBoolean(features, 'mcp'),
    tokenize: getBoolean(features, 'tokenize'),
    truncatePrompt: getBoolean(features, 'truncate_prompt'),
    hasConfigurationSchema: getBoolean(features, 'configuration'),
    systemPrompt: getBoolean(features, 'system_prompt'),
    tools: getBoolean(features, 'tools'),
    seed: getBoolean(features, 'seed'),
    urlAttachments: getBoolean(features, 'url_attachments'),
    folderAttachments: getBoolean(features, 'folder_attachments'),
    allowResume: getBoolean(features, 'allow_resume'),
    accessibleByPerRequestKey: getBoolean(
      features,
      'accessible_by_per_request_key',
    ),
    contentParts: getBoolean(features, 'content_parts'),
    temperature: getBoolean(features, 'temperature'),
    cache: getBoolean(features, 'cache'),
    autoCaching: getBoolean(features, 'auto_caching'),
    parallelToolCalls: getBoolean(features, 'parallel_tool_calls'),
    assistantAttachmentsInRequest: getBoolean(
      features,
      'assistant_attachments_in_request',
    ),
    chatCompletion:
      getBoolean(features, 'chat_completion') ??
      declaredInterfaces?.includes(DeploymentApiInterface.ChatCompletions),
    responsesApi:
      getBoolean(features, 'responses_api') ??
      declaredInterfaces?.includes(DeploymentApiInterface.Responses),
    ...(declaredInterfaces != null && {
      anthropicMessages: declaredInterfaces.includes(
        DeploymentApiInterface.Messages,
      ),
    }),
    skillsSupported: getBoolean(features, 'skills_supported'),
    maxTokensSupported: getBoolean(features, 'max_tokens_supported'),
    maxCompletionTokensSupported: getBoolean(
      features,
      'max_completion_tokens_supported',
    ),
    customTemperatureSupported: getBoolean(
      features,
      'custom_temperature_supported',
    ),
    reasoningEfforts,
  };
};

export const mapToDeploymentItem = (
  raw: RawDeploymentDto,
  featuredIds: Set<string>,
  hiddenTags: ReadonlySet<string>,
): DeploymentItemDto | null => {
  if (!raw.id) return null;

  let type: DeploymentItemType;
  if (raw.toolset !== undefined) {
    type = DeploymentItemType.Toolset;
  } else if (raw.object === 'application') {
    type = DeploymentItemType.Application;
  } else {
    type = DeploymentItemType.Model;
  }

  let interfaces: string[] | undefined;
  if (raw.interfaces) {
    if (Array.isArray(raw.interfaces)) {
      interfaces = raw.interfaces;
    } else {
      interfaces = [raw.interfaces];
    }
  }

  const topics = raw.description_keywords || [];
  const reasoningEfforts = Array.isArray(raw.features?.reasoning_efforts)
    ? raw.features.reasoning_efforts.filter(
        (effort): effort is string => typeof effort === 'string',
      )
    : [];
  /*
   * DIAL Core reports MCP support inconsistently depending on the endpoint
   * and deployment: the details endpoints set `features.mcp` (boolean), some
   * list entries attach a root-level `mcp` descriptor object (endpoint,
   * transport, allowedTools, ...), and others only list `"mcp"` inside
   * `interfaces` (the same classification Core's own `interface_type=mcp`
   * list filter relies on) with neither of the above present. Treat any of
   * the three as MCP-capable.
   */
  const hasMcp =
    raw.features?.mcp === true ||
    raw.mcp != null ||
    !!interfaces?.includes('mcp');
  const applicationProperties = isRecord(raw.application_properties)
    ? raw.application_properties
    : undefined;
  const conversationStarters =
    type === DeploymentItemType.Application
      ? mapConversationStarters(applicationProperties?.conversation_starters)
      : undefined;

  return {
    id: raw.id,
    displayName: raw.display_name ?? getResourceDisplayNameFallback(raw.id),
    type,
    iconUrl: raw.icon_url,
    description: raw.description,
    displayVersion: raw.display_version,
    versionGroupId:
      type === DeploymentItemType.Application
        ? getVersionGroupId(raw.id)
        : undefined,
    reference: raw.reference,
    isFeatured:
      featuredIds.has(raw.id) ||
      (raw.reference != null && featuredIds.has(raw.reference)),
    isHidden: hasHiddenEntityTag(raw.description_keywords, hiddenTags),
    updatedAt: raw.updated_at,
    createdAt: raw.created_at,
    interfaces,
    applicationTypeSchemaId:
      type === DeploymentItemType.Application && raw.application_type_schema_id
        ? raw.application_type_schema_id
        : undefined,
    viewerUrl:
      type === DeploymentItemType.Application &&
      typeof raw.viewer_url === 'string' &&
      raw.viewer_url.length > 0
        ? raw.viewer_url
        : undefined,
    inputAttachmentTypes: Array.isArray(raw.input_attachment_types)
      ? raw.input_attachment_types
      : undefined,
    features:
      raw.features || hasMcp
        ? {
            systemPrompt: raw.features?.system_prompt ?? false,
            temperature: raw.features?.temperature ?? false,
            ...(raw.features?.folder_attachments != null && {
              folderAttachments: raw.features.folder_attachments,
            }),
            ...(hasMcp && { mcp: true }),
            ...(raw.features?.responses_api === true && {
              responsesApi: true,
            }),
            ...(raw.features?.chat_completion === true && {
              chatCompletion: true,
            }),
            ...(raw.features?.skills_supported === true && {
              skillsSupported: true,
            }),
            ...(raw.features?.tools === true && {
              tools: true,
            }),
            ...(typeof raw.features?.parallel_tool_calls === 'boolean' && {
              parallelToolCalls: raw.features.parallel_tool_calls,
            }),
            ...(typeof raw.features?.cache === 'boolean' && {
              cache: raw.features.cache,
            }),
            ...(typeof raw.features?.auto_caching === 'boolean' && {
              autoCaching: raw.features.auto_caching,
            }),
            ...(reasoningEfforts.length > 0 && { reasoningEfforts }),
          }
        : undefined,
    maxInputAttachments:
      typeof raw.max_input_attachments === 'number'
        ? raw.max_input_attachments
        : undefined,
    topics,
    modelKinds: mapModelKinds(raw.capabilities),
    provider:
      typeof raw.provider === 'string' && raw.provider !== ''
        ? raw.provider
        : undefined,
    owner: raw.owner,
    applicationFolder:
      type === DeploymentItemType.Application && raw.id.includes('/')
        ? raw.id.substring(0, raw.id.lastIndexOf('/'))
        : undefined,
    conversationStarters,
  };
};
