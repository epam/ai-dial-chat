import type { operations } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { getResourceDisplayNameFallback } from '../common/utils/resource-name';
import type { EnvironmentVariables } from '../config/environment.config';
import { HIDDEN_FILE } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import type { DeploymentLimitsResponseDto } from '../openapi/openapi-response.dto';
import { UserConfigService } from '../user-config/user-config.service';
import type { DeploymentConfigurationDto } from './dto/deployment-configuration.dto';
import type {
  DeploymentDetailsDto,
  DeploymentFeaturesDetailsDto,
  ToolsetAuthSettingsDto,
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

const getString = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
};

const getStringArray = (
  record: Record<string, unknown>,
  key: string,
): string[] | undefined => {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
};

/**
 * DIAL Core's `auth_settings` payload carries more fields than the SDK's
 * `ResourceAuthSettingsData` type declares (e.g. `token_endpoint`,
 * `token_endpoint_auth_method`), so this reads defensively off the raw
 * object, mirroring `mapDeploymentFeatures`. `client_secret`/`code_verifier`
 * are never read, even if present on the raw payload — those are the only
 * fields excluded per the non-goal of never exposing OAuth client secrets.
 */
const mapToolsetAuthSettings = (
  raw: unknown,
): ToolsetAuthSettingsDto | undefined => {
  if (!isRecord(raw)) return undefined;

  return {
    authenticationType: getString(raw, 'authentication_type'),
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
const redactToolsetAuthSettings = (raw: unknown): unknown => {
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

  return {
    id: raw.id,
    displayName: raw.display_name ?? getResourceDisplayNameFallback(raw.id),
    type,
    iconUrl: raw.icon_url,
    description: raw.description,
    intro: raw.intro,
    displayVersion: raw.display_version,
    isFeatured: featuredIds.has(raw.id || raw.reference || ''),
    isHidden: topics.some((tag) => hiddenTags.has(tag)),
    updatedAt: raw.updated_at,
    createdAt: raw.created_at,
    interfaces,
    applicationTypeSchemaId:
      type === 'application' && raw.application_type_schema_id
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
      type === 'application' && raw.id.includes('/')
        ? raw.id.substring(0, raw.id.lastIndexOf('/'))
        : undefined,
  };
};

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);
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
    private readonly dialClient: DialClientService,
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly userConfigService: UserConfigService,
  ) {
    this.featuredIds = new Set(
      configService.get<string[]>('FEATURED_MODEL_IDS') ?? [],
    );

    this.hiddenTags = new Set(
      configService.get<string[]>('HIDDEN_ENTITY_TAGS') ?? [],
    );
  }

  /**
   * Evicts the cached deployments list for a user so the next
   * `listDeployments` call re-fetches from DIAL Core instead of serving a
   * stale snapshot — e.g. right after the user accepted a share invitation
   * granting access to a new application.
   */
  async invalidateListCache(userSub: string): Promise<void> {
    const baseCacheKey = `deployments:list:${userSub}`;
    await this.cacheManager.del(baseCacheKey);
    await Promise.all(
      Object.values(DeploymentInterfaceType)
        .filter((type) => type !== DeploymentInterfaceType.All)
        .map((type) =>
          this.cacheManager.del(`${baseCacheKey}:interface:${type}`),
        ),
    );
  }

  /**
   * Evicts a user's cached details for one deployment — e.g. right after a
   * toolset login/logout, so the details panel's next `getDeploymentDetails`
   * call re-reads the updated `userLevelAuthStatus` instead of the snapshot
   * cached before the credentials changed.
   */
  async invalidateDetailsCache(
    userSub: string,
    deployment: string,
  ): Promise<void> {
    await this.cacheManager.del(`deployments:details:${userSub}:${deployment}`);
  }

  private async tryGetRawModel(
    deployment: string,
    accessToken: string,
  ): Promise<RawDeploymentDto | null> {
    const result = await this.dialClient.client.getModel(deployment, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      if (result.response.status === 404) return null;
      return mapDialHttpStatus(
        result.response.status,
        `resolve model item "${deployment}"`,
        this.logger,
      );
    }
    if (result.data == null) return null;
    return { ...(result.data as RawDeploymentDto), id: deployment };
  }

  private async tryGetRawApplication(
    deployment: string,
    accessToken: string,
  ): Promise<RawDeploymentDto | null> {
    const result = await this.dialClient.client.getApplication(deployment, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      if (result.response.status === 404) return null;
      return mapDialHttpStatus(
        result.response.status,
        `resolve application item "${deployment}"`,
        this.logger,
      );
    }
    if (result.data == null) return null;
    return {
      ...(result.data as RawDeploymentDto),
      id: deployment,
      object: (result.data as RawDeploymentDto).object ?? 'application',
    };
  }

  /**
   * Resolves a single model or application by id into list-item shape
   * (`DeploymentItemDto`), for contexts that already know a specific id and
   * don't want to depend on a full `listDeployments` call — e.g. right after
   * accepting a share invitation, where waiting for the bulk list to reflect
   * a just-granted share is an unbounded race against DIAL Core's own
   * propagation. Unprefixed ids try model then application, mirroring
   * `fetchDeploymentDetails`'s ambiguous-id fallback. `toolsets/`-prefixed
   * ids are not resolved here — callers should use
   * `ToolsetsService.resolveToolsetItem` for those, and for ambiguous ids
   * that turn out not to be a model or application either.
   *
   * Returns `null` (not a thrown exception) when DIAL Core has no match —
   * only a genuine upstream error (5xx, network, timeout) propagates as an
   * exception.
   */
  async resolveDeploymentItem(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentItemDto | null> {
    if (deployment.startsWith('toolsets/')) return null;

    try {
      let raw: RawDeploymentDto | null;
      if (deployment.startsWith('applications/')) {
        raw = await this.tryGetRawApplication(deployment, accessToken);
      } else {
        raw = await this.tryGetRawModel(deployment, accessToken);
        if (raw == null) {
          raw = await this.tryGetRawApplication(deployment, accessToken);
        }
      }
      if (raw == null) return null;
      return mapToDeploymentItem(raw, this.featuredIds, this.hiddenTags);
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      return handleDialFetchError(
        err,
        `resolve deployment item "${deployment}"`,
        this.logger,
        0,
      );
    }
  }

  /**
   * Resolves every application resource shared with the current user
   * (READ or WRITE), in a single upstream call reused to derive both the
   * WRITE-only "can edit" set and the unfiltered "shared with me" set —
   * avoids issuing `getSharedResources` twice per list request. Best-effort:
   * a DIAL Core error here degrades to "no shared applications" rather than
   * failing the whole deployments list.
   */
  private async getSharedApplicationResources(
    accessToken: string,
  ): Promise<{ url?: string; permissions?: string[] }[]> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getSharedResources({
          headers: getBearerAuthHeaders(accessToken),
          body: { resourceTypes: ['APPLICATION'], with: 'me' },
        });
      if (error) {
        this.logger.warn(
          `Failed to resolve shared application resources: status=${response.status}`,
        );
        return [];
      }

      return (data?.resources ?? []) as {
        url?: string;
        permissions?: string[];
      }[];
    } catch (err) {
      this.logger.warn('Failed to resolve shared application resources', err);
      return [];
    }
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
        const result = await this.dialClient.client.listDeployments({
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
    const sharedApplicationResources =
      await this.getSharedApplicationResources(accessToken);
    const writableApplicationUrls = new Set(
      sharedApplicationResources
        .filter((resource) => resource.permissions?.includes('WRITE'))
        .map((resource) => resource.url)
        .filter((url): url is string => url != null),
    );
    const sharedApplicationUrls = new Set(
      sharedApplicationResources
        .map((resource) => resource.url)
        .filter((url): url is string => url != null),
    );

    const withInstalled = allItems.map((item) => {
      const isMy = item.id.split('/').includes(bucket);
      return {
        ...item,
        isInstalled:
          item.type === 'toolset'
            ? toolsetsSet.has(item.id)
            : deploymentsSet.has(item.id),
        isMy,
        canEdit: isMy || writableApplicationUrls.has(item.id),
        sharedWithMe: !isMy && sharedApplicationUrls.has(item.id),
      };
    });

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
      const result = await this.dialClient.client.configurationDeployment(
        name,
        {
          headers: getBearerAuthHeaders(accessToken),
        },
      );
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
    userSub: string,
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    const cacheKey = `deployments:details:${userSub}:${deployment}`;
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
   * classify one id. Ids with neither prefix are ambiguous — root-level
   * applications and root-level toolsets (e.g. a copied toolset without a
   * `toolsets/` prefix) are indistinguishable from a model id by shape
   * alone — so those try `getModel`, then `getApplication`, then
   * `getToolset` in turn, falling through to the next on a 404.
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
        data = await this.buildUnprefixedDeploymentDetails(
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

  private async buildUnprefixedDeploymentDetails(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    try {
      return await this.buildModelDetails(deployment, accessToken);
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
    }

    try {
      return await this.buildApplicationDetails(deployment, accessToken);
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
    }

    return this.buildToolsetDetails(deployment, accessToken);
  }

  private async buildModelDetails(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    const result = await this.dialClient.client.getModel(deployment, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get model details "${deployment}"`,
        this.logger,
      );
    }
    if (result.data == null) {
      this.logger.warn(
        `DIAL Core returned no body for get model details "${deployment}"`,
      );
      throw new NotFoundException('Resource not found');
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
    const result = await this.dialClient.client.getApplication(deployment, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get application details "${deployment}"`,
        this.logger,
      );
    }
    if (result.data == null) {
      this.logger.warn(
        `DIAL Core returned no body for get application details "${deployment}"`,
      );
      throw new NotFoundException('Resource not found');
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
    const result = await this.dialClient.client.getToolset(deployment, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get toolset details "${deployment}"`,
        this.logger,
      );
    }
    if (result.data == null) {
      this.logger.warn(
        `DIAL Core returned no body for get toolset details "${deployment}"`,
      );
      throw new NotFoundException('Resource not found');
    }
    const raw = result.data;
    this.logger.debug(
      `DIAL Core toolset details for "${deployment}": ${JSON.stringify(redactToolsetAuthSettings(raw))}`,
    );
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
        authSettings: mapToolsetAuthSettings(raw.auth_settings),
        owner: raw.owner,
        features: mapDeploymentFeatures(raw.features),
        createdAt: raw.created_at,
      },
    };

    this.logger.debug(
      `Toolset details sent to frontend for "${deployment}": ${JSON.stringify(data)}`,
    );

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
      const result = await this.dialClient.client.getToolSetTools(deployment, {
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        this.logger.warn(
          `DIAL Core returned ${result.response.status} for getToolSetTools "${deployment}"`,
        );
        return undefined;
      }
      return result.data?.tools
        ?.map((tool) => tool.name)
        .filter((name): name is string => typeof name === 'string');
    } catch (err) {
      this.logger.warn(
        `getToolSetTools "${deployment}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  async getDeploymentLimits(
    deploymentName: string,
    accessToken: string,
  ): Promise<DeploymentLimitsResponseDto> {
    try {
      const result = await this.dialClient.client.getDeploymentLimits(
        deploymentName,
        {
          headers: getBearerAuthHeaders(accessToken),
        },
      );
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
