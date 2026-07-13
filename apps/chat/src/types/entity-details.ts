/**
 * Strongly-typed domain models for entity-specific detail data.
 * All domain enums live here because they represent backend vocabulary.
 * The app-layer mapper converts these into the lib's `CatalogItemTabData` shape.
 */

// ---- Shared enums ----

export enum AuthenticationType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
  ServiceAccount = 'SERVICE_ACCOUNT',
  Pat = 'PAT',
}

// ---- Model entity ----

export enum ModelProvider {
  OpenAI = 'OPEN_AI',
  Anthropic = 'ANTHROPIC',
  Google = 'GOOGLE',
  Meta = 'META',
  Mistral = 'MISTRAL',
  Azure = 'AZURE',
  Amazon = 'AMAZON',
  Cohere = 'COHERE',
}

export enum ModelEndpointType {
  AzureOpenAI = 'AZURE_OPEN_AI',
  Anthropic = 'ANTHROPIC',
  Responses = 'RESPONSES',
}

export interface ModelEndpointSnippets {
  pythonSnippet?: string;
  curlSnippet?: string;
  jsSnippet?: string;
}

export interface ModelEndpoint {
  type: ModelEndpointType;
  url: string;
  snippets?: ModelEndpointSnippets;
}

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

export interface ModelPricing {
  inputTokensPrice?: string;
  outputTokensPrice?: string;
  cachedInputPrice?: string;
  batchPrice?: string;
  dailyLimit?: string;
  weeklyLimit?: string;
  monthlyLimit?: string;
}

export interface ModelApiDetails {
  modelId?: string;
  endpoints?: ModelEndpoint[];
}

export interface ModelEntityDetails {
  provider?: ModelProvider;
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

// ---- Skill entity ----

export interface SkillAboutDetails {
  whenToUse?: string;
  allowedTools?: string[];
  bundledResources?: string[];
  skillPrompt?: string;
}

export interface SkillEntityDetails {
  about?: SkillAboutDetails;
}

// ---- Discriminated union ----

export type EntitySpecificDetails =
  | { type: 'MODEL'; data: ModelEntityDetails }
  | { type: 'AGENT'; data: AgentEntityDetails }
  | { type: 'TOOLSET'; data: ToolsetEntityDetails }
  | { type: 'GUARDRAIL'; data: GuardrailEntityDetails }
  | { type: 'SKILL'; data: SkillEntityDetails };
