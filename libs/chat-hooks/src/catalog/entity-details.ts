/** Toolset authentication mechanism as reported by DIAL Core. */
export enum AuthenticationType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
}

// ---- Model entity ----

/*
 * hasMcp/hasCaching/hasUrlAttachments/hasFolderAttachments/hasSeed/
 * hasSystemPrompt/hasResume are deliberately not rendered by
 * mapModelDetails's Capabilities section — kept here since the backend
 * still returns them and another consumer may want them later.
 */
/** Feature-support flags for a model deployment. */
export interface ModelCapabilities {
  hasTools?: boolean;
  hasMcp?: boolean;
  hasCaching?: boolean;
  hasParallelToolCalls?: boolean;
  hasUrlAttachments?: boolean;
  hasFolderAttachments?: boolean;
  hasSeed?: boolean;
  hasSystemPrompt?: boolean;
  hasResume?: boolean;
  hasChatCompletion?: boolean;
  hasResponsesApi?: boolean;
  reasoningEfforts?: string[];
}

/** Catalog-facing specification fields for a model deployment. */
export interface ModelSpecification {
  provider?: string;
  vendor?: string;
  license?: string;
  knowledgeCutoffDate?: string;
  parameters?: string;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  inputTypes?: string[];
  hostedBy?: string;
  createdAt?: number;
}

/** One priced unit for a model deployment. */
export interface ModelPriceRow {
  /** DIAL Core pricing key, e.g. `prompt`, `completion`, `cache_read`. */
  key: string;
  /** Per-unit price formatted for display, e.g. `$3/M tokens`. */
  price: string;
}

/** A model deployment's full price list. */
export interface ModelPricing {
  /** Every price DIAL Core reports for the deployment, `unit` excluded. */
  prices?: ModelPriceRow[];
}

/** API-resource identifiers for a model deployment. */
export interface ModelApiDetails {
  modelId?: string;
}

/** Full details payload for a model-type deployment. */
export interface ModelEntityDetails {
  capabilities?: ModelCapabilities;
  specification?: ModelSpecification;
  pricing?: ModelPricing;
  api?: ModelApiDetails;
}

// ---- Agent entity ----

/** Catalog-facing specification fields for an agent (application) deployment. */
export interface AgentSpecification {
  hostedBy?: string;
  createdAt?: number;
  routes?: string[];
}

/*
 * hasMcp/hasCaching/hasUrlAttachments/hasFolderAttachments/hasSeed/
 * hasSystemPrompt/hasResume are deliberately not rendered by
 * mapAgentDetails's Capabilities section — kept here since the backend
 * still returns them and another consumer may want them later.
 */
/** Feature-support flags for an agent (application) deployment. */
export interface AgentCapabilities {
  hasTools?: boolean;
  hasMcp?: boolean;
  hasCaching?: boolean;
  hasParallelToolCalls?: boolean;
  hasUrlAttachments?: boolean;
  hasFolderAttachments?: boolean;
  hasSeed?: boolean;
  hasSystemPrompt?: boolean;
  hasResume?: boolean;
  hasConfiguration?: boolean;
  hasChatCompletion?: boolean;
  hasResponsesApi?: boolean;
}

/** Input-attachment configuration for an agent (application) deployment. */
export interface AgentConfiguration {
  inputAttachmentTypes?: string[];
}

/** Full details payload for an agent (application)-type deployment. */
export interface AgentEntityDetails {
  specification?: AgentSpecification;
  configuration?: AgentConfiguration;
  capabilities?: AgentCapabilities;
}

// ---- Toolset entity ----

/** Sign-in status at both the personal and org-wide (global) level for a toolset. */
export interface ToolsetAuthStatusDetails {
  global?: string;
  appLevel?: string;
  userLevel?: string;
  scopesSupported?: string[];
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  apiKeyHeader?: string;
}

/** Catalog-facing specification fields for a toolset. */
export interface ToolsetSpecification {
  authentication?: AuthenticationType;
  permissions?: string[];
  hostedBy?: string;
  authStatus?: ToolsetAuthStatusDetails;
  createdAt?: number;
  /** Names of all tools the underlying MCP server supports, not just the allow-listed subset in `permissions`. */
  allTools?: string[];
}

/*
 * hasMcp/hasCaching/hasSystemPrompt/hasResume are deliberately not rendered
 * by mapToolsetDetails's Capabilities section — kept here since the backend
 * still returns them and another consumer may want them later.
 */
/** Feature-support flags for a toolset. */
export interface ToolsetCapabilities {
  hasMcp?: boolean;
  hasCaching?: boolean;
  hasSystemPrompt?: boolean;
  hasResume?: boolean;
}

/** Full details payload for a toolset-type deployment. */
export interface ToolsetEntityDetails {
  specification?: ToolsetSpecification;
  capabilities?: ToolsetCapabilities;
}

// ---- Discriminated union ----

/*
 * Built only by `mapDeploymentDetailsDtoToEntityDetails`. Skills never reach
 * the deployment details endpoint — their details resolve from the skills
 * endpoints and their manifest — so they are not a member here.
 */
/** Discriminated-union entity details for a deployment, keyed by catalog entity type. */
export type EntitySpecificDetails =
  | { type: 'MODEL'; data: ModelEntityDetails }
  | { type: 'AGENT'; data: AgentEntityDetails }
  | { type: 'TOOLSET'; data: ToolsetEntityDetails };
