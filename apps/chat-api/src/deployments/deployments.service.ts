import type { operations } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { AppService } from '../app/app.service';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import type { EnvironmentVariables } from '../config/environment.config';
import { HIDDEN_FILE } from '../constants/dial.constants';
import type { DeploymentLimitsResponseDto } from '../openapi/openapi-response.dto';
import { UserConfigService } from '../user-config/user-config.service';
import type { DeploymentConfigurationDto } from './dto/deployment-configuration.dto';
import type {
  DeploymentDetailsDto,
  DeploymentFeaturesDetailsDto,
} from './dto/deployment-details.dto';
import type {
  DeploymentItemDto,
  DeploymentsResponseDto,
} from './dto/deployment-item.dto';
import { DeploymentInterfaceType } from './dto/deployments-query.dto';
import { RawDeploymentDto } from './dto/raw-deployment.dto';

type DialDeploymentInterfaceType = NonNullable<
  NonNullable<
    operations['listDeployments']['parameters']['query']
  >['interface_type']
>[number];

const isRecord = (val: unknown): val is Record<string, unknown> =>
  val != null && typeof val === 'object' && !Array.isArray(val);

const toAdditionalProperties = (
  val: unknown,
): boolean | Record<string, unknown> | undefined => {
  if (typeof val === 'boolean') return val;
  if (isRecord(val)) return val;
  return undefined;
};

const getBoolean = (
  record: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
};

const getNumber = (
  record: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
};

/**
 * DIAL Core's runtime `features` payload includes more flags than the
 * `DeploymentFeatures` SDK type declares (e.g. chat_completion, responses_api,
 * reasoning_efforts), so this reads defensively off the raw object instead of
 * the typed SDK shape.
 */
const mapDeploymentFeatures = (
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

const mapToDeploymentItem = (
  raw: RawDeploymentDto,
  featuredIds: Set<string>,
  hiddenTags: Set<string>,
): DeploymentItemDto | null => {
  if (!raw.id) return null;

  let type: 'model' | 'application' | 'toolset';
  if (raw.toolset !== undefined) {
    type = 'toolset';
  } else if (raw.object === 'application') {
    type = 'application';
  } else {
    type = 'model';
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

  return {
    id: raw.id,
    displayName: raw.display_name ?? raw.id,
    type,
    iconUrl: raw.icon_url,
    description: raw.description,
    displayVersion: raw.display_version,
    isFeatured: featuredIds.has(raw.id || raw.reference || ''),
    isHidden: topics.some((tag) => hiddenTags.has(tag)),
    updatedAt: raw.updated_at,
    interfaces,
    applicationTypeSchemaId:
      type === 'application' && raw.application_type_schema_id
        ? raw.application_type_schema_id
        : undefined,
    inputAttachmentTypes: Array.isArray(raw.input_attachment_types)
      ? raw.input_attachment_types
      : undefined,
    features: raw.features
      ? {
          systemPrompt: raw.features.system_prompt ?? false,
          temperature: raw.features.temperature ?? false,
          ...(raw.features.folder_attachments != null && {
            folderAttachments: raw.features.folder_attachments,
          }),
        }
      : undefined,
    maxInputAttachments:
      typeof raw.max_input_attachments === 'number'
        ? raw.max_input_attachments
        : undefined,
    topics,
    owner: raw.owner,
    applicationFolder:
      type === 'application' && raw.id.includes('/')
        ? raw.id.substring(0, raw.id.lastIndexOf('/'))
        : undefined,
  };
};

@Injectable()
export class DeploymentsService extends AppService {
  protected override readonly logger = new Logger(DeploymentsService.name);
  private readonly featuredIds: Set<string>;
  private readonly hiddenTags: Set<string>;
  /**
   * In-flight `getDeploymentDetails` requests keyed by cache key, so
   * concurrent requests for the same deployment share one upstream call
   * instead of racing each other before the cache is populated.
   */
  private readonly pendingDetailsRequests = new Map<
    string,
    Promise<DeploymentDetailsDto>
  >();

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly userConfigService: UserConfigService,
  ) {
    super(configService);
    this.featuredIds = new Set(
      this.configService.get<string[]>('FEATURED_MODEL_IDS') ?? [],
    );

    this.hiddenTags = new Set(
      this.configService.get<string[]>('HIDDEN_ENTITY_TAGS') ?? [],
    );
  }

  async listDeployments(
    userSub: string,
    accessToken: string,
    bucket: string,
    interfaceType?: DeploymentInterfaceType[],
  ): Promise<DeploymentsResponseDto> {
    const baseCacheKey = `deployments:list:${userSub}`;
    const normalizedTypes = interfaceType?.filter(
      (t) => t !== DeploymentInterfaceType.All,
    );
    const interfaceFilter = (
      normalizedTypes && normalizedTypes.length > 0
        ? normalizedTypes
        : undefined
    ) as DialDeploymentInterfaceType[] | undefined;
    const cacheKey = interfaceFilter
      ? `${baseCacheKey}:interface:${interfaceFilter.join(',')}`
      : baseCacheKey;
    const cached =
      (await this.cacheManager.get<DeploymentItemDto[]>(cacheKey)) ??
      (interfaceFilter
        ? await this.cacheManager.get<DeploymentItemDto[]>(baseCacheKey)
        : undefined);

    let allItems: DeploymentItemDto[];
    if (cached) {
      this.logger.debug(`Cache hit for deployments list (sub: ${userSub})`);
      allItems = cached;
    } else {
      try {
        const result = await this.client.listDeployments({
          headers: getBearerAuthHeaders(accessToken),
          params: interfaceFilter
            ? { query: { interface_type: interfaceFilter } }
            : undefined,
        });
        if (result.error) {
          return mapDialHttpStatus(
            result.response.status,
            'list deployments',
            this.logger,
          );
        }
        const rawData = result.data as unknown;
        const rawItems = Array.isArray(rawData)
          ? (rawData as RawDeploymentDto[])
          : ((rawData as { deployments?: RawDeploymentDto[] }).deployments ??
            []);

        allItems = rawItems
          .filter((item) => item.id && !item.id.includes(HIDDEN_FILE))
          .map((item) =>
            mapToDeploymentItem(item, this.featuredIds, this.hiddenTags),
          )
          .filter((item): item is DeploymentItemDto => item !== null);

        await this.cacheManager.set(cacheKey, allItems, 30_000);
      } catch (err) {
        return handleDialFetchError(err, 'list deployments', this.logger, 0);
      }
    }

    const { toolsets: toolsetIds, deployments: deploymentIds } =
      await this.userConfigService.getInstalledIds(accessToken, bucket);
    const toolsetsSet = new Set(toolsetIds);
    const deploymentsSet = new Set(deploymentIds);

    const withInstalled = allItems.map((item) => ({
      ...item,
      isInstalled:
        item.type === 'toolset'
          ? toolsetsSet.has(item.id)
          : deploymentsSet.has(item.id),
      isMy: item.id.split('/').includes(bucket),
    }));

    if (!interfaceFilter) {
      return { deployments: withInstalled };
    }

    const filtered = withInstalled.filter((item) =>
      item.interfaces?.some((iface) =>
        interfaceFilter.includes(iface as DialDeploymentInterfaceType),
      ),
    );
    return { deployments: filtered };
  }

  async getDeploymentConfiguration(
    name: string,
    userSub: string,
    accessToken: string,
  ): Promise<DeploymentConfigurationDto> {
    const cacheKey = `deployments:configuration:${userSub}:${name}`;
    const cached =
      await this.cacheManager.get<DeploymentConfigurationDto>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for deployment configuration "${name}" (sub: ${userSub})`,
      );
      return cached;
    }

    try {
      const result = await this.client.configurationDeployment(name, {
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          `get deployment configuration "${name}"`,
          this.logger,
        );
      }
      const raw = result.data ?? {};

      const data: DeploymentConfigurationDto = {
        type: typeof raw['type'] === 'string' ? raw['type'] : undefined,
        title: typeof raw['title'] === 'string' ? raw['title'] : undefined,
        properties: isRecord(raw['properties']) ? raw['properties'] : undefined,
        additionalProperties: toAdditionalProperties(
          raw['additionalProperties'],
        ),
        isChatMessageInputDisabled:
          raw['dial:chatMessageInputDisabled'] === true || undefined,
      };
      await this.cacheManager.set(cacheKey, data, 60 * 1000);
      return data;
    } catch (err) {
      return handleDialFetchError(
        err,
        `get deployment configuration "${name}"`,
        this.logger,
        0,
      );
    }
  }

  async getDeploymentDetails(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    const cacheKey = `deployments:details:${deployment}`;
    const cached = await this.cacheManager.get<DeploymentDetailsDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for deployment details "${deployment}"`);
      return cached;
    }

    const pending = this.pendingDetailsRequests.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `Joining in-flight request for deployment details "${deployment}"`,
      );
      return pending;
    }

    const request = this.fetchDeploymentDetails(
      deployment,
      accessToken,
      cacheKey,
    );
    this.pendingDetailsRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      this.pendingDetailsRequests.delete(cacheKey);
    }
  }

  /**
   * Resolves type from the id prefix convention already used on the
   * frontend (`toolsets/…`, `applications/…`) instead of calling
   * `listDeployments` — avoids an expensive full-catalog fetch just to
   * classify one id. Ids with neither prefix are ambiguous (root-level
   * applications don't always carry the `applications/` prefix), so those
   * try `getModel` first and fall back to `getApplication` on a 404.
   */
  private async fetchDeploymentDetails(
    deployment: string,
    accessToken: string,
    cacheKey: string,
  ): Promise<DeploymentDetailsDto> {
    let data: DeploymentDetailsDto;
    try {
      if (deployment.startsWith('toolsets/')) {
        data = await this.buildToolsetDetails(deployment, accessToken);
      } else if (deployment.startsWith('applications/')) {
        data = await this.buildApplicationDetails(deployment, accessToken);
      } else {
        data = await this.buildModelOrApplicationDetails(
          deployment,
          accessToken,
        );
      }
    } catch (err) {
      return handleDialFetchError(
        err,
        `get deployment details "${deployment}"`,
        this.logger,
        0,
      );
    }

    await this.cacheManager.set(cacheKey, data, 60 * 1000);
    return data;
  }

  private async buildModelOrApplicationDetails(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    try {
      return await this.buildModelDetails(deployment, accessToken);
    } catch (err) {
      if (err instanceof NotFoundException) {
        return this.buildApplicationDetails(deployment, accessToken);
      }
      throw err;
    }
  }

  private async buildModelDetails(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    const result = await this.client.getModel(deployment, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get model details "${deployment}"`,
        this.logger,
      );
    }
    const raw = result.data;
    const limits = raw.limits;

    const data: DeploymentDetailsDto = {
      id: deployment,
      type: 'model',
      modelDetails: {
        capabilities: raw.capabilities
          ? {
              completion: raw.capabilities.completion,
              chatCompletion: raw.capabilities.chat_completion,
              embeddings: raw.capabilities.embeddings,
              fineTune: raw.capabilities.fine_tune,
              inference: raw.capabilities.inference,
              scaleTypes: raw.capabilities.scale_types,
            }
          : undefined,
        lifecycleStatus: raw.lifecycle_status,
        tokenizerModel: raw.tokenizer_model,
        limits: limits
          ? {
              maxTotalTokens:
                'max_total_tokens' in limits
                  ? limits.max_total_tokens
                  : undefined,
              maxPromptTokens:
                'max_prompt_tokens' in limits
                  ? limits.max_prompt_tokens
                  : undefined,
              maxCompletionTokens:
                'max_completion_tokens' in limits
                  ? limits.max_completion_tokens
                  : undefined,
            }
          : undefined,
        pricing: raw.pricing
          ? {
              unit: raw.pricing.unit,
              prompt: raw.pricing.prompt,
              completion: raw.pricing.completion,
            }
          : undefined,
        features: mapDeploymentFeatures(raw.features),
        owner: raw.owner,
        inputAttachmentTypes: Array.isArray(raw.input_attachment_types)
          ? raw.input_attachment_types
          : undefined,
        defaultMaxTokens: isRecord(raw.defaults)
          ? getNumber(raw.defaults, 'max_tokens')
          : undefined,
        createdAt: raw.created_at,
      },
    };

    return data;
  }

  private async buildApplicationDetails(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    const result = await this.client.getApplication(deployment, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get application details "${deployment}"`,
        this.logger,
      );
    }
    const raw = result.data;

    const data: DeploymentDetailsDto = {
      id: deployment,
      type: 'application',
      applicationDetails: {
        applicationProperties: isRecord(raw.application_properties)
          ? raw.application_properties
          : undefined,
        functionRuntime: raw.function?.runtime,
        functionStatus: raw.function?.status,
        routes: raw.routes ? Object.keys(raw.routes) : undefined,
        owner: raw.owner,
        features: mapDeploymentFeatures(raw.features),
        inputAttachmentTypes: Array.isArray(raw.input_attachment_types)
          ? raw.input_attachment_types
          : undefined,
        applicationTypeSchemaId: raw.application_type_schema_id,
        createdAt: raw.created_at,
      },
    };

    return data;
  }

  private async buildToolsetDetails(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    const result = await this.client.getToolset(deployment, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get toolset details "${deployment}"`,
        this.logger,
      );
    }
    const raw = result.data;
    const allToolNames = await this.getAllToolSetToolNames(
      deployment,
      accessToken,
    );

    const data: DeploymentDetailsDto = {
      id: deployment,
      type: 'toolset',
      toolsetDetails: {
        transport: raw.transport,
        allowedTools: Array.isArray(raw.allowed_tools)
          ? raw.allowed_tools.filter(
              (tool): tool is string => typeof tool === 'string',
            )
          : undefined,
        allToolNames,
        authSettings: raw.auth_settings
          ? {
              authenticationType: raw.auth_settings.authentication_type,
              globalAuthStatus: raw.auth_settings.global_auth_status,
              appLevelAuthStatus: raw.auth_settings.app_level_auth_status,
              userLevelAuthStatus: raw.auth_settings.user_level_auth_status,
              scopesSupported: raw.auth_settings.scopes_supported,
              authorizationEndpoint: raw.auth_settings.authorization_endpoint,
              tokenEndpoint: raw.auth_settings.token_endpoint,
              apiKeyHeader: raw.auth_settings.api_key_header,
            }
          : undefined,
        owner: raw.owner,
        features: mapDeploymentFeatures(raw.features),
        createdAt: raw.created_at,
      },
    };

    return data;
  }

  /**
   * Best-effort: `GET /v1/toolset/{id}/tools` (all tools the MCP server
   * supports, not just the allow-listed subset) is supplementary context for
   * the details view, not required for a valid response — a failure here
   * must not fail the whole `getDeploymentDetails` call.
   */
  private async getAllToolSetToolNames(
    deployment: string,
    accessToken: string,
  ): Promise<string[] | undefined> {
    try {
      const result = await this.client.getAllToolSetTools(deployment, {
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        this.logger.warn(
          `DIAL Core returned ${result.response.status} for getAllToolSetTools "${deployment}"`,
        );
        return undefined;
      }
      return result.data?.result?.tools
        ?.map((tool) => tool.name)
        .filter((name): name is string => typeof name === 'string');
    } catch (err) {
      this.logger.warn(
        `getAllToolSetTools "${deployment}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  async getDeploymentLimits(
    deploymentName: string,
    accessToken: string,
  ): Promise<DeploymentLimitsResponseDto> {
    try {
      const result = await this.client.getDeploymentLimits(deploymentName, {
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          `get deployment limits "${deploymentName}"`,
          this.logger,
        );
      }
      return result.data as unknown as DeploymentLimitsResponseDto;
    } catch (err) {
      return handleDialFetchError(
        err,
        `get deployment limits "${deploymentName}"`,
        this.logger,
        0,
      );
    }
  }
}
