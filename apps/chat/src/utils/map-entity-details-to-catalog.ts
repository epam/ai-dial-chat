import type {
  CatalogItemApiDetails,
  CatalogItemCredentials,
  CatalogItemPricing,
  CatalogItemTabData,
  CodeSnippet,
  EndpointOption,
  OverviewSection,
} from '@epam/ai-dial-catalog';
import {
  CodeLanguage,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentDetailsDto,
  DeploymentFeaturesDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { AuthenticationType, ModelEndpointType } from '../types/entity-details';
import type {
  AgentEntityDetails,
  EntitySpecificDetails,
  GuardrailEntityDetails,
  ModelEndpoint,
  ModelEntityDetails,
  ModelPricing,
  SkillEntityDetails,
  ToolsetAuthStatus,
  ToolsetEntityDetails,
} from '../types/entity-details';
import { isPublicToolsetId } from './toolsets';

const ENDPOINT_LABELS: Record<ModelEndpointType, string> = {
  [ModelEndpointType.AzureOpenAI]: 'Azure OpenAI Endpoint',
  [ModelEndpointType.Anthropic]: 'Anthropic Endpoint',
  [ModelEndpointType.Responses]: 'Responses Endpoint',
};

const formatTokens = (n: number): string =>
  n >= 1_000_000
    ? `${n / 1_000_000}M tokens`
    : n >= 1_000
      ? `${n / 1_000}K tokens`
      : `${n} tokens`;

const formatReleaseDate = (timestampMs: number): string =>
  new Date(timestampMs).toLocaleDateString();

const mapEndpointSnippets = (endpoint: ModelEndpoint): CodeSnippet[] => {
  const snippets: CodeSnippet[] = [];
  const { snippets: s } = endpoint;
  if (s == null) return snippets;
  if (s.pythonSnippet != null)
    snippets.push({ language: CodeLanguage.Python, code: s.pythonSnippet });
  if (s.curlSnippet != null)
    snippets.push({ language: CodeLanguage.Curl, code: s.curlSnippet });
  if (s.jsSnippet != null)
    snippets.push({ language: CodeLanguage.JavaScript, code: s.jsSnippet });
  return snippets;
};

const mapModelDetails = (data: ModelEntityDetails): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.capabilities != null) {
    const { capabilities: c } = data;
    const specs: OverviewSection['specs'] = [];

    if (c.hasTools != null) specs.push({ label: 'Tools', value: c.hasTools });
    if (c.hasMcp != null) specs.push({ label: 'MCP', value: c.hasMcp });
    if (c.hasCaching != null)
      specs.push({ label: 'Prompt caching', value: c.hasCaching });
    if (c.hasParallelToolCalls != null)
      specs.push({
        label: 'Parallel tool calls',
        value: c.hasParallelToolCalls,
      });
    if (c.hasUrlAttachments != null)
      specs.push({ label: 'URL attachments', value: c.hasUrlAttachments });
    if (c.hasFolderAttachments != null)
      specs.push({
        label: 'Folder attachments',
        value: c.hasFolderAttachments,
      });
    if (c.hasSeed != null) specs.push({ label: 'Seed', value: c.hasSeed });
    if (c.hasSystemPrompt != null)
      specs.push({ label: 'System prompt', value: c.hasSystemPrompt });
    if (c.hasResume != null)
      specs.push({ label: 'Resume', value: c.hasResume });
    if (c.reasoningEfforts?.length)
      specs.push({
        label: 'Reasoning efforts',
        value: c.reasoningEfforts.join(' · '),
      });

    if (specs.length > 0) sections.push({ title: 'Capabilities', specs });
  }

  if (data.specification != null) {
    const { specification: s } = data;
    const specs: OverviewSection['specs'] = [];

    if (s.hostedBy != null)
      specs.push({ label: 'Hosted by', value: s.hostedBy });
    if (s.createdAt != null)
      specs.push({
        label: 'Release date',
        value: formatReleaseDate(s.createdAt),
      });
    if (s.contextWindowTokens != null)
      specs.push({
        label: 'Context window',
        value: formatTokens(s.contextWindowTokens),
      });
    if (s.maxOutputTokens != null)
      specs.push({
        label: 'Max output tokens',
        value: formatTokens(s.maxOutputTokens),
      });
    if (s.inputTypes?.length)
      specs.push({ label: 'Input type', value: s.inputTypes.join(' · ') });
    if (s.outputTypes?.length)
      specs.push({ label: 'Output type', value: s.outputTypes.join(' · ') });
    if (s.languages?.length)
      specs.push({ label: 'Languages', value: s.languages.join(' · ') });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });
  }

  const pricing = mapModelPricing(data.pricing);
  const api = mapModelApi(data);

  return {
    overview: sections.length > 0 ? { sections } : undefined,
    pricing,
    api,
  };
};

const mapModelPricing = (
  pricing: ModelPricing | undefined,
): CatalogItemPricing | undefined => {
  if (pricing == null) return undefined;

  const prices = [
    pricing.inputTokensPrice != null && {
      label: 'Input tokens',
      price: pricing.inputTokensPrice,
    },
    pricing.outputTokensPrice != null && {
      label: 'Output tokens',
      price: pricing.outputTokensPrice,
    },
    pricing.cachedInputPrice != null && {
      label: 'Cached input',
      price: pricing.cachedInputPrice,
    },
    pricing.batchPrice != null && {
      label: 'Batch / async',
      price: pricing.batchPrice,
    },
  ].filter(Boolean) as CatalogItemPricing['prices'];

  const limits = [
    pricing.dailyLimit != null && {
      label: 'Daily limit',
      value: pricing.dailyLimit,
    },
    pricing.weeklyLimit != null && {
      label: 'Weekly limit',
      value: pricing.weeklyLimit,
    },
    pricing.monthlyLimit != null && {
      label: 'Monthly limit',
      value: pricing.monthlyLimit,
    },
  ].filter(Boolean) as CatalogItemPricing['limits'];

  if (!prices?.length && !limits?.length) return undefined;
  return { prices, limits };
};

/**
 * Maps endpoint-type variants (Azure OpenAI / Anthropic / Responses) shared
 * by models and agents into the lib's endpoint-selector shape.
 */
const mapApiEndpoints = (
  endpoints: ModelEndpoint[] | undefined,
): EndpointOption[] | undefined =>
  endpoints != null && endpoints.length > 0
    ? endpoints.map((e) => ({
        label: ENDPOINT_LABELS[e.type] ?? e.type,
        url: e.url,
        snippets: mapEndpointSnippets(e),
      }))
    : undefined;

const mapModelApi = (
  data: ModelEntityDetails,
): CatalogItemApiDetails | undefined => {
  const { api } = data;
  if (api == null) return undefined;

  const resource = api.modelId != null ? { modelId: api.modelId } : undefined;
  const endpoints = mapApiEndpoints(api.endpoints);

  if (resource == null && endpoints == null) return undefined;
  return { resource, endpoints };
};

const mapAgentDetails = (data: AgentEntityDetails): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.specification != null) {
    const { specification: s } = data;
    const specs: OverviewSection['specs'] = [];

    if (s.domain != null) specs.push({ label: 'Domain', value: s.domain });
    if (s.useCase != null) specs.push({ label: 'Use case', value: s.useCase });
    if (s.maturity != null)
      specs.push({ label: 'Maturity', value: s.maturity });
    if (s.permissions?.length)
      specs.push({ label: 'Permissions', value: s.permissions.join(' · ') });
    if (s.skills?.length)
      specs.push({ label: 'Skills', value: s.skills.join(' · ') });
    if (s.hostedBy != null)
      specs.push({ label: 'Hosted by', value: s.hostedBy });
    if (s.createdAt != null)
      specs.push({
        label: 'Release date',
        value: formatReleaseDate(s.createdAt),
      });
    if (s.routes?.length)
      specs.push({ label: 'Routes', value: s.routes.join(' · ') });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });
  }

  if (data.capabilities != null) {
    const { capabilities: c } = data;
    const specs: OverviewSection['specs'] = [];

    if (c.hasTools != null) specs.push({ label: 'Tools', value: c.hasTools });
    if (c.hasMcp != null) specs.push({ label: 'MCP', value: c.hasMcp });
    if (c.hasCaching != null)
      specs.push({ label: 'Prompt caching', value: c.hasCaching });
    if (c.hasParallelToolCalls != null)
      specs.push({
        label: 'Parallel tool calls',
        value: c.hasParallelToolCalls,
      });
    if (c.hasUrlAttachments != null)
      specs.push({ label: 'URL attachments', value: c.hasUrlAttachments });
    if (c.hasFolderAttachments != null)
      specs.push({
        label: 'Folder attachments',
        value: c.hasFolderAttachments,
      });
    if (c.hasSeed != null) specs.push({ label: 'Seed', value: c.hasSeed });
    if (c.hasSystemPrompt != null)
      specs.push({ label: 'System prompt', value: c.hasSystemPrompt });
    if (c.hasResume != null)
      specs.push({ label: 'Resume', value: c.hasResume });
    if (c.hasConfiguration != null)
      specs.push({ label: 'Configuration schema', value: c.hasConfiguration });

    if (specs.length > 0) sections.push({ title: 'Capabilities', specs });
  }

  if (data.configuration != null) {
    const { configuration: c } = data;
    const specs: OverviewSection['specs'] = [];

    if (c.baseModelId != null)
      specs.push({ label: 'Base model', value: c.baseModelId });
    if (c.inputAttachmentTypes?.length)
      specs.push({
        label: 'Input attachments',
        value: c.inputAttachmentTypes.join(' · '),
      });
    if (c.outputAttachmentTypes?.length)
      specs.push({
        label: 'Output attachments',
        value: c.outputAttachmentTypes.join(' · '),
      });
    if (c.authentication != null)
      specs.push({ label: 'Authentication', value: c.authentication });

    if (specs.length > 0) sections.push({ title: 'Configuration', specs });
  }

  if (data.capabilityLinks?.length) {
    sections.push({
      title: 'References',
      specs: data.capabilityLinks.map((ref) => ({
        label: ref.id,
        value: ref.label,
      })),
    });
  }

  const api: CatalogItemApiDetails | undefined =
    data.api != null
      ? {
          resource:
            data.api.endpointUrl != null
              ? { endpointUrl: data.api.endpointUrl }
              : undefined,
          endpoints: mapApiEndpoints(data.api.endpoints),
          requestExample: data.api.requestExample,
          responseSchema: data.api.responseSchema,
        }
      : undefined;

  return {
    overview: sections.length > 0 ? { sections } : undefined,
    api,
  };
};

const TOOLSET_AUTHENTICATION_TYPE_MAP: Partial<
  Record<AuthenticationType, ToolsetAuthenticationType>
> = {
  [AuthenticationType.None]: ToolsetAuthenticationType.None,
  [AuthenticationType.ApiKey]: ToolsetAuthenticationType.ApiKey,
  [AuthenticationType.OAuth]: ToolsetAuthenticationType.OAuth,
};

const TOOLSET_AUTH_STATUS_MAP: Record<string, CredentialStatus> = {
  SIGNED_IN: CredentialStatus.SignedIn,
  SIGNED_OUT: CredentialStatus.SignedOut,
  FAILED: CredentialStatus.Failed,
};

/**
 * Maps a toolset's specification into the lib's credential-status shape,
 * for refreshing the details panel after login/logout. Includes both
 * `USER` and `GLOBAL` status, whether the toolset is public, and whether
 * the current user (if an admin) may manage both levels.
 */
export const mapToolsetCredentials = (
  toolsetId: string,
  data: ToolsetEntityDetails,
  isAdmin: boolean,
): CatalogItemCredentials | undefined => {
  const authenticationType =
    TOOLSET_AUTHENTICATION_TYPE_MAP[
      data.specification?.authentication ?? AuthenticationType.None
    ];
  if (authenticationType == null) return undefined;

  const { userLevel, global } = data.specification?.authStatus ?? {};
  const isPublic = isPublicToolsetId(toolsetId);

  return {
    authenticationType,
    userStatus: userLevel ? TOOLSET_AUTH_STATUS_MAP[userLevel] : undefined,
    globalStatus: global ? TOOLSET_AUTH_STATUS_MAP[global] : undefined,
    isPublic,
    isManageableByAdmin: isAdmin && isPublic,
    apiKeyHeader: data.specification?.authStatus?.apiKeyHeader,
  };
};

const mapToolsetDetails = (data: ToolsetEntityDetails): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.specification != null) {
    const { specification: s } = data;
    const specs: OverviewSection['specs'] = [];

    if (s.provider != null)
      specs.push({ label: 'Provider', value: s.provider });
    if (s.authentication != null)
      specs.push({ label: 'Authentication', value: s.authentication });
    if (s.permissions?.length)
      specs.push({ label: 'Allowed tools', value: s.permissions.join(' · ') });
    if (s.allTools?.length)
      specs.push({
        label: 'All supported tools',
        value: s.allTools.join(' · '),
      });
    if (s.hostedBy != null)
      specs.push({ label: 'Hosted by', value: s.hostedBy });
    if (s.createdAt != null)
      specs.push({
        label: 'Release date',
        value: formatReleaseDate(s.createdAt),
      });
    if (s.authStatus?.scopesSupported?.length)
      specs.push({
        label: 'OAuth scopes',
        value: s.authStatus.scopesSupported.join(' · '),
      });
    if (s.authStatus?.authorizationEndpoint != null)
      specs.push({
        label: 'Authorization endpoint',
        value: s.authStatus.authorizationEndpoint,
      });
    if (s.authStatus?.tokenEndpoint != null)
      specs.push({
        label: 'Token endpoint',
        value: s.authStatus.tokenEndpoint,
      });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });
  }

  if (data.capabilities != null) {
    const { capabilities: c } = data;
    const specs: OverviewSection['specs'] = [];

    if (c.hasMcp != null) specs.push({ label: 'MCP', value: c.hasMcp });
    if (c.hasCaching != null)
      specs.push({ label: 'Prompt caching', value: c.hasCaching });
    if (c.hasSystemPrompt != null)
      specs.push({ label: 'System prompt', value: c.hasSystemPrompt });
    if (c.hasResume != null)
      specs.push({ label: 'Resume', value: c.hasResume });

    if (specs.length > 0) sections.push({ title: 'Capabilities', specs });
  }

  return {
    overview: sections.length > 0 ? { sections } : undefined,
  };
};

const mapGuardrailDetails = (
  data: GuardrailEntityDetails,
): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.specification != null) {
    const { specification: s } = data;
    const specs: OverviewSection['specs'] = [];

    if (s.stage != null) specs.push({ label: 'Stage', value: s.stage });
    if (s.type != null) specs.push({ label: 'Type', value: s.type });
    if (s.checks?.length)
      specs.push({ label: 'Checks', value: s.checks.join(' · ') });
    if (s.actionOnMatch != null)
      specs.push({ label: 'Action on match', value: s.actionOnMatch });
    if (s.sensitivity != null)
      specs.push({ label: 'Sensitivity', value: s.sensitivity });
    if (s.compliance?.length)
      specs.push({ label: 'Compliance', value: s.compliance.join(' · ') });
    if (s.appliesTo?.length)
      specs.push({ label: 'Applies to', value: s.appliesTo.join(' · ') });
    if (s.failureMode != null)
      specs.push({ label: 'Failure mode', value: s.failureMode });
    if (s.hasLogging != null)
      specs.push({ label: 'Logging', value: s.hasLogging });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });
  }

  return {
    overview: sections.length > 0 ? { sections } : undefined,
  };
};

const mapSkillDetails = (data: SkillEntityDetails): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.about != null) {
    const { about: a } = data;
    const specs: OverviewSection['specs'] = [];

    if (a.allowedTools?.length)
      specs.push({ label: 'Allowed tools', value: a.allowedTools.join(' · ') });
    if (a.bundledResources?.length)
      specs.push({
        label: 'Bundled resources',
        value: a.bundledResources.join(' · '),
      });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });

    if (a.skillPrompt != null) {
      sections.push({
        title: 'Context',
        specs: [{ label: 'Skill prompt', value: a.skillPrompt }],
      });
    }
  }

  return {
    overview: sections.length > 0 ? { sections } : undefined,
  };
};

/** Converts a strongly-typed entity domain model into the lib's `CatalogItemTabData` shape. */
export const mapEntityDetailsToCatalogDetails = (
  details: EntitySpecificDetails,
): CatalogItemTabData => {
  switch (details.type) {
    case 'MODEL':
      return mapModelDetails(details.data);
    case 'AGENT':
      return mapAgentDetails(details.data);
    case 'TOOLSET':
      return mapToolsetDetails(details.data);
    case 'GUARDRAIL':
      return mapGuardrailDetails(details.data);
    case 'SKILL':
      return mapSkillDetails(details.data);
  }
};

/**
 * Superset of the `has*` capability flags used by `ModelCapabilities`,
 * `AgentCapabilities`, and `ToolsetCapabilities` — all fields on those types
 * are optional, so this can be assigned to any of them directly.
 */
interface DeploymentCapabilities {
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
  reasoningEfforts?: string[];
}

/**
 * Feature flags are structurally identical across model, application, and
 * toolset detail responses (`DeploymentFeaturesDetailsDto`), so one mapper
 * produces the superset of `has*` capability flags; callers assign the
 * result to whichever entity-specific `*Capabilities` type they need.
 */
const mapFeaturesToCapabilities = (
  features: DeploymentFeaturesDetailsDto | undefined,
): DeploymentCapabilities | undefined => {
  if (features == null) return undefined;

  return {
    hasTools: features.tools,
    hasMcp: features.mcp,
    hasCaching: features.cache,
    hasParallelToolCalls: features.parallelToolCalls,
    hasUrlAttachments: features.urlAttachments,
    hasFolderAttachments: features.folderAttachments,
    hasSeed: features.seed,
    hasSystemPrompt: features.systemPrompt,
    hasResume: features.allowResume,
    hasConfiguration: features.hasConfigurationSchema,
    reasoningEfforts: features.reasoningEfforts,
  };
};

const mapModelDetailsDto = (
  dto: DeploymentDetailsDto,
): EntitySpecificDetails => {
  const {
    limits,
    pricing,
    features,
    owner,
    inputAttachmentTypes,
    defaultMaxTokens,
    createdAt,
  } = dto.modelDetails ?? {};

  const hasSpecification =
    limits != null ||
    owner != null ||
    createdAt != null ||
    (inputAttachmentTypes?.length ?? 0) > 0;

  return {
    type: 'MODEL',
    data: {
      capabilities: mapFeaturesToCapabilities(features),
      specification: hasSpecification
        ? {
            contextWindowTokens: limits?.maxTotalTokens,
            maxOutputTokens: limits?.maxCompletionTokens ?? defaultMaxTokens,
            inputTypes: inputAttachmentTypes,
            hostedBy: owner,
            createdAt,
          }
        : undefined,
      pricing:
        pricing != null
          ? {
              inputTokensPrice: pricing.prompt,
              outputTokensPrice: pricing.completion,
            }
          : undefined,
      api: { modelId: dto.id },
    },
  };
};

const mapApplicationDetailsDto = (
  dto: DeploymentDetailsDto,
): EntitySpecificDetails => {
  const { routes, owner, inputAttachmentTypes, features, createdAt } =
    dto.applicationDetails ?? {};

  const hasSpecification =
    owner != null || createdAt != null || (routes?.length ?? 0) > 0;

  return {
    type: 'AGENT',
    data: {
      capabilities: mapFeaturesToCapabilities(features),
      specification: hasSpecification
        ? {
            hostedBy: owner,
            createdAt,
            routes,
          }
        : undefined,
      configuration: inputAttachmentTypes?.length
        ? { inputAttachmentTypes }
        : undefined,
    },
  };
};

const isKnownToolsetAuthType = (
  value: string | undefined,
): value is AuthenticationType =>
  value === AuthenticationType.None ||
  value === AuthenticationType.ApiKey ||
  value === AuthenticationType.OAuth;

const mapToolsetAuthStatus = (
  authSettings: NonNullable<
    DeploymentDetailsDto['toolsetDetails']
  >['authSettings'],
): ToolsetAuthStatus | undefined => {
  if (authSettings == null) return undefined;
  const {
    globalAuthStatus,
    appLevelAuthStatus,
    userLevelAuthStatus,
    scopesSupported,
    authorizationEndpoint,
    tokenEndpoint,
    apiKeyHeader,
  } = authSettings;

  if (
    globalAuthStatus == null &&
    appLevelAuthStatus == null &&
    userLevelAuthStatus == null &&
    authorizationEndpoint == null &&
    tokenEndpoint == null &&
    apiKeyHeader == null &&
    !scopesSupported?.length
  ) {
    return undefined;
  }

  return {
    global: globalAuthStatus,
    appLevel: appLevelAuthStatus,
    userLevel: userLevelAuthStatus,
    scopesSupported,
    authorizationEndpoint,
    tokenEndpoint,
    apiKeyHeader,
  };
};

const mapToolsetDetailsDto = (
  dto: DeploymentDetailsDto,
): EntitySpecificDetails => {
  const toolsetDetails = dto.toolsetDetails;
  const authenticationType = toolsetDetails?.authSettings?.authenticationType;

  return {
    type: 'TOOLSET',
    data: {
      capabilities: mapFeaturesToCapabilities(toolsetDetails?.features),
      specification:
        toolsetDetails != null
          ? {
              authentication: isKnownToolsetAuthType(authenticationType)
                ? authenticationType
                : undefined,
              permissions: toolsetDetails.allowedTools,
              allTools: toolsetDetails.allToolNames,
              hostedBy: toolsetDetails.owner,
              createdAt: toolsetDetails.createdAt,
              authStatus: mapToolsetAuthStatus(toolsetDetails.authSettings),
            }
          : undefined,
    },
  };
};

/**
 * Converts the backend `DeploymentDetailsDto` (model/application/toolset,
 * fetched by id) into the strongly-typed `EntitySpecificDetails` domain model
 * consumed by `mapEntityDetailsToCatalogDetails`.
 */
export const mapDeploymentDetailsDtoToEntityDetails = (
  dto: DeploymentDetailsDto,
): EntitySpecificDetails => {
  switch (dto.type) {
    case 'model':
      return mapModelDetailsDto(dto);
    case 'application':
      return mapApplicationDetailsDto(dto);
    case 'toolset':
      return mapToolsetDetailsDto(dto);
  }
};
