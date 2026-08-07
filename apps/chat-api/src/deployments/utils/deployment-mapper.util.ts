import { getResourceDisplayNameFallback } from '../../common/utils/resource-name';
import type {
  DeploymentFeaturesDetailsDto,
  ToolsetAuthSettingsDto,
} from '../dto/deployment-details.dto';
import { DeploymentItemType } from '../dto/deployment-item.dto';
import type {
  ConversationStartersDto,
  DeploymentItemDto,
} from '../dto/deployment-item.dto';
import { RawDeploymentDto } from '../dto/raw-deployment.dto';

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
 * DIAL Core's runtime `features` payload includes more flags than the
 * `DeploymentFeatures` SDK type declares (e.g. chat_completion, responses_api,
 * reasoning_efforts), so this reads defensively off the raw object instead of
 * the typed SDK shape.
 */
export const mapDeploymentFeatures = (
  raw: unknown,
): DeploymentFeaturesDetailsDto | undefined => {
  if (!isRecord(raw)) return undefined;

  const reasoningEfforts = Array.isArray(raw.reasoning_efforts)
    ? raw.reasoning_efforts.filter(
        (effort): effort is string => typeof effort === 'string',
      )
    : undefined;

  return {
    rate: getBoolean(raw, 'rate'),
    mcp: getBoolean(raw, 'mcp'),
    tokenize: getBoolean(raw, 'tokenize'),
    truncatePrompt: getBoolean(raw, 'truncate_prompt'),
    hasConfigurationSchema: getBoolean(raw, 'configuration'),
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
    chatCompletion: getBoolean(raw, 'chat_completion'),
    responsesApi: getBoolean(raw, 'responses_api'),
    maxTokensSupported: getBoolean(raw, 'max_tokens_supported'),
    maxCompletionTokensSupported: getBoolean(
      raw,
      'max_completion_tokens_supported',
    ),
    customTemperatureSupported: getBoolean(raw, 'custom_temperature_supported'),
    reasoningEfforts,
  };
};

export const mapToDeploymentItem = (
  raw: RawDeploymentDto,
  featuredIds: Set<string>,
  hiddenTags: Set<string>,
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
    isFeatured: featuredIds.has(raw.id || raw.reference || ''),
    isHidden: topics.some((tag) => hiddenTags.has(tag)),
    updatedAt: raw.updated_at,
    createdAt: raw.created_at,
    interfaces,
    applicationTypeSchemaId:
      type === DeploymentItemType.Application && raw.application_type_schema_id
        ? raw.application_type_schema_id
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
          }
        : undefined,
    maxInputAttachments:
      typeof raw.max_input_attachments === 'number'
        ? raw.max_input_attachments
        : undefined,
    topics,
    owner: raw.owner,
    applicationFolder:
      type === DeploymentItemType.Application && raw.id.includes('/')
        ? raw.id.substring(0, raw.id.lastIndexOf('/'))
        : undefined,
    conversationStarters,
  };
};
