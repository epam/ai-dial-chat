import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { resolveLocalizedValue } from '../../common/utils/localized-value';
import { DialClientService } from '../../dial/dial-client.service';
import type { DeploymentLimitsResponseDto } from '../../openapi/openapi-response.dto';
import type { DeploymentConfigurationDto } from '../dto/deployment-configuration.dto';
import type { DeploymentDetailsDto } from '../dto/deployment-details.dto';
import { DeploymentItemType } from '../dto/deployment-item.dto';
import {
  getNumber,
  isRecord,
  mapDeploymentFeatures,
  mapToolsetAuthSettings,
  redactToolsetAuthSettings,
  toAdditionalProperties,
} from '../utils/deployment-mapper.util';

@Injectable()
export class DeploymentsDetailsService {
  private readonly logger = new Logger(DeploymentsDetailsService.name);
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
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

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
        encodeDialResourcePath(name),
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
    const result = await this.dialClient.client.getModel(
      encodeDialResourcePath(deployment),
      {
        headers: getBearerAuthHeaders(accessToken),
      },
    );
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
      type: DeploymentItemType.Model,
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
        pricing: raw.pricing,
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
    const result = await this.dialClient.client.getApplication(
      encodeDialResourcePath(deployment),
      {
        headers: getBearerAuthHeaders(accessToken),
      },
    );
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
    this.logger.debug(
      `DIAL Core application details for "${deployment}": ${JSON.stringify(raw)}`,
    );
    const rawRecord = raw as unknown as Record<string, unknown>;

    /* For applications with an `applications/{bucket}/{path}` ID, fetch the
     * full config via getCustomApplication to get endpoint —
     * getApplication (model listing) does not expose that field. */
    let customAppRaw: Record<string, unknown> | undefined;
    const appParts = deployment.startsWith('applications/')
      ? deployment.slice('applications/'.length).split('/')
      : undefined;
    if (appParts && appParts.length >= 2) {
      const bucket = appParts[0];
      const path = encodeDialResourcePath(appParts.slice(1).join('/'));
      const customResult = await this.dialClient.client.getCustomApplication(
        bucket,
        path,
        { headers: getBearerAuthHeaders(accessToken) },
      );
      if (!customResult.error && customResult.data != null) {
        customAppRaw = customResult.data as unknown as Record<string, unknown>;
      }
    }

    const data: DeploymentDetailsDto = {
      id: deployment,
      type: DeploymentItemType.Application,
      applicationDetails: {
        displayName: resolveLocalizedValue(raw.display_name),
        applicationProperties: (() => {
          const base = isRecord(raw.application_properties)
            ? raw.application_properties
            : {};
          /* Include raw features from the custom-app config so the editor
           * textarea can display them. DIAL Core expands stored features with
           * all defaults, so the user may see more keys than they originally
           * entered — this is the most accurate representation available. */
          const storedFeatures = customAppRaw?.features as unknown;
          const merged =
            storedFeatures != null
              ? { ...base, features: storedFeatures }
              : base;
          return Object.keys(merged).length > 0 ? merged : undefined;
        })(),
        functionRuntime: raw.function?.runtime,
        functionStatus: raw.function?.status,
        routes: raw.routes ? Object.keys(raw.routes) : undefined,
        owner: raw.owner,
        features: mapDeploymentFeatures(raw.features),
        inputAttachmentTypes: Array.isArray(raw.input_attachment_types)
          ? raw.input_attachment_types
          : undefined,
        applicationTypeSchemaId: raw.application_type_schema_id,
        endpoint:
          typeof customAppRaw?.endpoint === 'string'
            ? customAppRaw.endpoint
            : typeof rawRecord.endpoint === 'string'
              ? rawRecord.endpoint
              : undefined,
        maxInputAttachments:
          typeof raw.max_input_attachments === 'number'
            ? raw.max_input_attachments
            : undefined,
        createdAt: raw.created_at,
      },
    };

    this.logger.debug(
      `Application details sent to frontend for "${deployment}": ${JSON.stringify(data)}`,
    );

    return data;
  }

  private async buildToolsetDetails(
    deployment: string,
    accessToken: string,
  ): Promise<DeploymentDetailsDto> {
    const result = await this.dialClient.client.getToolset(
      encodeDialResourcePath(deployment),
      {
        headers: getBearerAuthHeaders(accessToken),
      },
    );
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
      type: DeploymentItemType.Toolset,
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
      const result = await this.dialClient.client.getToolSetTools(
        encodeDialResourcePath(deployment),
        {
          headers: getBearerAuthHeaders(accessToken),
        },
      );
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
        encodeDialResourcePath(deploymentName),
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
