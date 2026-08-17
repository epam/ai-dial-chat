export enum AuthenticationType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
  ServiceAccount = 'SERVICE_ACCOUNT',
  Pat = 'PAT',
}

// ---- Model entity ----

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
  reasoningEfforts?: string[];
}

export interface ModelSpecification {
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  inputTypes?: string[];
  outputTypes?: string[];
  languages?: string[];
  hostedBy?: string;
  createdAt?: number;
}

export interface ModelPriceRow {
  /* DIAL Core pricing key, e.g. `prompt`, `completion`, `cache_read`. */
  key: string;
  /* Per-unit price formatted for display, e.g. `$3/M tokens`. */
  price: string;
}

export interface ModelPricing {
  /* Every price DIAL Core reports for the deployment, `unit` excluded. */
  prices?: ModelPriceRow[];
  dailyLimit?: string;
  weeklyLimit?: string;
  monthlyLimit?: string;
}

export interface ModelApiDetails {
  modelId?: string;
}

export interface ModelEntityDetails {
  capabilities?: ModelCapabilities;
  specification?: ModelSpecification;
  pricing?: ModelPricing;
  api?: ModelApiDetails;
}

// ---- Agent entity ----

export enum AgentDomain {
  Engineering = 'ENGINEERING',
  Marketing = 'MARKETING',
  Sales = 'SALES',
  Operations = 'OPERATIONS',
  Hr = 'HR',
  Finance = 'FINANCE',
  General = 'GENERAL',
}

export enum AgentMaturity {
  Experimental = 'EXPERIMENTAL',
  Beta = 'BETA',
  Production = 'PRODUCTION',
  Deprecated = 'DEPRECATED',
}

export interface AgentSpecification {
  domain?: AgentDomain;
  useCase?: string;
  maturity?: AgentMaturity;
  permissions?: string[];
  skills?: string[];
  hostedBy?: string;
  createdAt?: number;
  routes?: string[];
}

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
}

export interface AgentConfiguration {
  baseModelId?: string;
  inputAttachmentTypes?: string[];
  outputAttachmentTypes?: string[];
  authentication?: AuthenticationType;
}

export interface AgentCapabilityLink {
  id: string;
  label: string;
}

export interface AgentApiDetails {
  endpointUrl?: string;
  requestExample?: string;
  responseSchema?: string;
}

export interface AgentEntityDetails {
  specification?: AgentSpecification;
  configuration?: AgentConfiguration;
  capabilities?: AgentCapabilities;
  capabilityLinks?: AgentCapabilityLink[];
  api?: AgentApiDetails;
}

// ---- Toolset entity ----

export interface ToolsetAuthStatus {
  global?: string;
  appLevel?: string;
  userLevel?: string;
  scopesSupported?: string[];
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  apiKeyHeader?: string;
}

export interface ToolsetSpecification {
  provider?: string;
  authentication?: AuthenticationType;
  permissions?: string[];
  hostedBy?: string;
  authStatus?: ToolsetAuthStatus;
  createdAt?: number;
  /** Names of all tools the underlying MCP server supports, not just the allow-listed subset in `permissions`. */
  allTools?: string[];
}

export interface ToolsetCapabilities {
  hasMcp?: boolean;
  hasCaching?: boolean;
  hasSystemPrompt?: boolean;
  hasResume?: boolean;
}

export interface ToolsetEntityDetails {
  specification?: ToolsetSpecification;
  capabilities?: ToolsetCapabilities;
}

// ---- Guardrail entity ----

export enum GuardrailStage {
  Input = 'INPUT',
  Output = 'OUTPUT',
  Both = 'BOTH',
}

export enum GuardrailType {
  PiiRedaction = 'PII_REDACTION',
  ContentModeration = 'CONTENT_MODERATION',
  PromptInjectionGuard = 'PROMPT_INJECTION_GUARD',
  CostRateControl = 'COST_RATE_CONTROL',
  Logging = 'LOGGING',
  Transformation = 'TRANSFORMATION',
}

export enum GuardrailAction {
  Block = 'BLOCK',
  Redact = 'REDACT',
  Mask = 'MASK',
  Flag = 'FLAG',
  Fallback = 'FALLBACK',
  Allow = 'ALLOW',
}

export enum GuardrailSensitivity {
  None = 'NONE',
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
}

export enum GuardrailFailureMode {
  FailOpen = 'FAIL_OPEN',
  FailClosed = 'FAIL_CLOSED',
}

export interface GuardrailSpecification {
  stage?: GuardrailStage;
  type?: GuardrailType;
  checks?: string[];
  actionOnMatch?: GuardrailAction;
  sensitivity?: GuardrailSensitivity;
  compliance?: string[];
  appliesTo?: string[];
  failureMode?: GuardrailFailureMode;
  hasLogging?: boolean;
}

export interface GuardrailEntityDetails {
  specification?: GuardrailSpecification;
}

// ---- Discriminated union ----

/*
 * Built only by `mapDeploymentDetailsDtoToEntityDetails`. Skills never reach
 * the deployment details endpoint — their details resolve from the skills
 * endpoints and their manifest — so they are not a member here.
 */
export type EntitySpecificDetails =
  | { type: 'MODEL'; data: ModelEntityDetails }
  | { type: 'AGENT'; data: AgentEntityDetails }
  | { type: 'TOOLSET'; data: ToolsetEntityDetails }
  | { type: 'GUARDRAIL'; data: GuardrailEntityDetails };
