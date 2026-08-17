import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeploymentItemType } from './deployment-item.dto';

export class ModelCapabilitiesDto {
  @ApiPropertyOptional({ description: 'True if the model is a completion' })
  completion?: boolean;

  @ApiPropertyOptional({
    description: 'True if the model is a chat completion',
  })
  chatCompletion?: boolean;

  @ApiPropertyOptional({ description: 'True if the model is an embedding' })
  embeddings?: boolean;

  @ApiPropertyOptional({ description: 'True if it is a fine-tuned model' })
  fineTune?: boolean;

  @ApiPropertyOptional({ description: 'True if the model can be deployed' })
  inference?: boolean;

  @ApiPropertyOptional({
    description: 'Scale types of the model (defaults to ["standard"])',
    type: [String],
  })
  scaleTypes?: string[];
}

export class ModelLimitsDto {
  @ApiPropertyOptional({
    description:
      'Maximum number of tokens allowed in a completion request and response combined',
  })
  maxTotalTokens?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of tokens allowed in a completion request',
  })
  maxPromptTokens?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of tokens allowed in a completion response',
  })
  maxCompletionTokens?: number;
}

/*
 * DIAL Core quotes pricing as an open-ended map: `unit` names the billing unit
 * and every other key (`prompt`, `completion`, `cache_read`, and
 * deployment-specific ones) holds a per-unit price, so the map is forwarded
 * verbatim instead of whitelisting a fixed set of keys.
 */
export type ModelPricingRecord = Record<string, string | undefined>;

export class ModelCatalogPropertiesDto {
  @ApiPropertyOptional({ description: 'Model provider for catalog display' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Model vendor for catalog display' })
  vendor?: string;

  @ApiPropertyOptional({ description: 'Model license for catalog display' })
  license?: string;

  @ApiPropertyOptional({
    description: 'Model knowledge cutoff date for catalog display',
    example: '2026-08-17',
  })
  knowledgeCutoffDate?: string;
}

/**
 * Feature flags shared by DIAL Core's model, application, and toolset
 * detail responses (all extend the same `DeploymentWithFeatures` schema).
 */
export class DeploymentFeaturesDetailsDto {
  @ApiPropertyOptional({ description: 'Supports the /rate endpoint' })
  rate?: boolean;

  @ApiPropertyOptional({ description: 'Supports MCP requests' })
  mcp?: boolean;

  @ApiPropertyOptional({ description: 'Supports the /tokenize endpoint' })
  tokenize?: boolean;

  @ApiPropertyOptional({
    description: 'Supports the /truncate_prompt endpoint',
  })
  truncatePrompt?: boolean;

  @ApiPropertyOptional({
    description: 'Exposes a JSON Schema configuration endpoint',
  })
  hasConfigurationSchema?: boolean;

  @ApiPropertyOptional({ description: 'Supports a custom system prompt' })
  systemPrompt?: boolean;

  @ApiPropertyOptional({
    description: 'Supports tools/functions in chat completion requests',
  })
  tools?: boolean;

  @ApiPropertyOptional({ description: 'Supports the seed parameter' })
  seed?: boolean;

  @ApiPropertyOptional({ description: 'Supports URL attachments' })
  urlAttachments?: boolean;

  @ApiPropertyOptional({ description: 'Supports folder attachments' })
  folderAttachments?: boolean;

  @ApiPropertyOptional({ description: 'Supports resuming conversations' })
  allowResume?: boolean;

  @ApiPropertyOptional({
    description: 'Accessible using a per-request API key',
  })
  accessibleByPerRequestKey?: boolean;

  @ApiPropertyOptional({ description: 'Supports content parts in messages' })
  contentParts?: boolean;

  @ApiPropertyOptional({ description: 'Supports the temperature parameter' })
  temperature?: boolean;

  @ApiPropertyOptional({ description: 'Supports LLM prompt caching' })
  cache?: boolean;

  @ApiPropertyOptional({ description: 'Supports automatic prompt caching' })
  autoCaching?: boolean;

  @ApiPropertyOptional({ description: 'Supports parallel tool calls' })
  parallelToolCalls?: boolean;

  @ApiPropertyOptional({
    description: 'Supports assistant attachments in the request',
  })
  assistantAttachmentsInRequest?: boolean;

  @ApiPropertyOptional({ description: 'Supports chat completion requests' })
  chatCompletion?: boolean;

  @ApiPropertyOptional({ description: 'Supports the responses API' })
  responsesApi?: boolean;

  @ApiPropertyOptional({ description: 'Supports the max_tokens parameter' })
  maxTokensSupported?: boolean;

  @ApiPropertyOptional({
    description: 'Supports the max_completion_tokens parameter',
  })
  maxCompletionTokensSupported?: boolean;

  @ApiPropertyOptional({
    description: 'Supports a custom temperature value',
  })
  customTemperatureSupported?: boolean;

  @ApiPropertyOptional({
    description:
      'Supported reasoning-effort levels, e.g. ["low","medium","high"]',
    type: [String],
  })
  reasoningEfforts?: string[];
}

export class ModelDetailsDto {
  @ApiPropertyOptional({ type: ModelCapabilitiesDto })
  capabilities?: ModelCapabilitiesDto;

  @ApiPropertyOptional({ description: 'Lifecycle status of the model' })
  lifecycleStatus?: string;

  @ApiPropertyOptional({
    description:
      'Name of the model whose tokenization algorithm this model uses',
  })
  tokenizerModel?: string;

  @ApiPropertyOptional({ type: ModelLimitsDto })
  limits?: ModelLimitsDto;

  @ApiPropertyOptional({
    description:
      'Pricing as reported by DIAL Core: `unit` names the billing unit and every other key holds the per-unit price for that key',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { unit: 'token', prompt: '0.000003', completion: '0.000015' },
  })
  pricing?: ModelPricingRecord;

  @ApiPropertyOptional({ type: DeploymentFeaturesDetailsDto })
  features?: DeploymentFeaturesDetailsDto;

  @ApiPropertyOptional({
    type: ModelCatalogPropertiesDto,
    description:
      'Known model catalog properties allow-listed from DIAL Core catalog_properties',
  })
  catalogProperties?: ModelCatalogPropertiesDto;

  @ApiPropertyOptional({
    description: 'Owner of the deployment as reported by DIAL Core',
  })
  owner?: string;

  @ApiPropertyOptional({
    description: 'Accepted MIME types for input attachments',
    type: [String],
  })
  inputAttachmentTypes?: string[];

  @ApiPropertyOptional({
    description: 'Default max_tokens value applied when a request omits it',
  })
  defaultMaxTokens?: number;

  @ApiPropertyOptional({
    description:
      'Timestamp of creation time from DIAL Core (e.g. 1714768496000)',
  })
  createdAt?: number;
}

export class ToolsetAuthSettingsDto {
  @ApiPropertyOptional({
    description: 'Type of authentication',
    enum: ['OAUTH', 'API_KEY', 'NONE'],
  })
  authenticationType?: string;

  @ApiPropertyOptional({
    description:
      'Whether DIAL Core dynamically registered the OAuth client instead of using user-provided client configuration',
    example: true,
  })
  dynamicallyRegistered?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether the toolset has global (shared) credentials signed in',
    enum: ['SIGNED_IN', 'SIGNED_OUT'],
  })
  globalAuthStatus?: string;

  @ApiPropertyOptional({
    description: 'Whether the toolset has app-level credentials signed in',
    enum: ['SIGNED_IN', 'SIGNED_OUT'],
  })
  appLevelAuthStatus?: string;

  @ApiPropertyOptional({
    description:
      'Whether the current user has user-level credentials signed in',
    enum: ['SIGNED_IN', 'SIGNED_OUT'],
  })
  userLevelAuthStatus?: string;

  @ApiPropertyOptional({
    description: 'OAuth scopes supported by this toolset',
    type: [String],
  })
  scopesSupported?: string[];

  @ApiPropertyOptional({ description: '(OAuth only) Authorization endpoint' })
  authorizationEndpoint?: string;

  @ApiPropertyOptional({ description: '(OAuth only) Token endpoint' })
  tokenEndpoint?: string;

  @ApiPropertyOptional({
    description: '(API key only) Header name the API key is sent in',
  })
  apiKeyHeader?: string;

  @ApiPropertyOptional({
    description: '(OAuth only) Public OAuth client id — not a secret',
  })
  clientId?: string;

  @ApiPropertyOptional({ description: '(OAuth only) OAuth redirect URI' })
  redirectUri?: string;

  @ApiPropertyOptional({
    description: '(OAuth only) Token endpoint authentication method',
  })
  tokenEndpointAuthMethod?: string;

  @ApiPropertyOptional({
    description:
      '(OAuth/PKCE only) PKCE code challenge — the challenge itself is not secret, only the verifier is',
  })
  codeChallenge?: string;

  @ApiPropertyOptional({
    description: '(OAuth/PKCE only) PKCE challenge method (e.g. S256)',
  })
  codeChallengeMethod?: string;
}

export class ApplicationDetailsDto {
  @ApiPropertyOptional({ description: 'Display name reported by DIAL Core' })
  displayName?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Non-secret custom application properties reported by DIAL Core',
  })
  applicationProperties?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Runtime environment for the function' })
  functionRuntime?: string;

  @ApiPropertyOptional({
    description: 'Current deployment status of the function',
  })
  functionStatus?: string;

  @ApiPropertyOptional({
    description: 'Custom route names exposed by the application',
    type: [String],
  })
  routes?: string[];

  @ApiPropertyOptional({
    description: 'Owner of the deployment as reported by DIAL Core',
  })
  owner?: string;

  @ApiPropertyOptional({ type: DeploymentFeaturesDetailsDto })
  features?: DeploymentFeaturesDetailsDto;

  @ApiPropertyOptional({
    description: 'Accepted MIME types for input attachments',
    type: [String],
  })
  inputAttachmentTypes?: string[];

  @ApiPropertyOptional({
    description: 'URI of the custom application type schema, when present',
  })
  applicationTypeSchemaId?: string;

  @ApiPropertyOptional({
    description: 'Chat completion endpoint URL for custom applications',
  })
  endpoint?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of input attachments for custom applications',
  })
  maxInputAttachments?: number;

  @ApiPropertyOptional({
    description:
      'Timestamp of creation time from DIAL Core (e.g. 1714768496000)',
  })
  createdAt?: number;
}

export class ToolsetDetailsDto {
  @ApiPropertyOptional({
    description: 'Transport supported by the MCP server (HTTP or SSE)',
  })
  transport?: string;

  @ApiPropertyOptional({
    description: 'Names of tools allowed for use from this toolset',
    type: [String],
  })
  allowedTools?: string[];

  @ApiPropertyOptional({
    description:
      'Names of all tools supported by the underlying MCP server, regardless of whether they are allow-listed. From GET /v1/toolset/{id}/tools.',
    type: [String],
  })
  allToolNames?: string[];

  @ApiPropertyOptional({ type: ToolsetAuthSettingsDto })
  authSettings?: ToolsetAuthSettingsDto;

  @ApiPropertyOptional({
    description: 'Owner of the deployment as reported by DIAL Core',
  })
  owner?: string;

  @ApiPropertyOptional({ type: DeploymentFeaturesDetailsDto })
  features?: DeploymentFeaturesDetailsDto;

  @ApiPropertyOptional({
    description:
      'Timestamp of creation time from DIAL Core (e.g. 1714768496000)',
  })
  createdAt?: number;
}

export class DeploymentDetailsDto {
  @ApiProperty({ description: 'The requested deployment id' })
  id!: string;

  @ApiProperty({ enum: DeploymentItemType })
  type!: DeploymentItemType;

  @ApiPropertyOptional({ type: ModelDetailsDto })
  modelDetails?: ModelDetailsDto;

  @ApiPropertyOptional({ type: ApplicationDetailsDto })
  applicationDetails?: ApplicationDetailsDto;

  @ApiPropertyOptional({ type: ToolsetDetailsDto })
  toolsetDetails?: ToolsetDetailsDto;
}
