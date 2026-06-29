import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/utils/dial-fetch-error';
import type { EnvironmentVariables } from '../config/environment.config';
import { HIDDEN_FILE } from '../constants/dial.constants';
import type { DeploymentLimitsResponseDto } from '../openapi/openapi-response.dto';
import { UserConfigService } from '../user-config/user-config.service';
import type { DeploymentConfigurationDto } from './dto/deployment-configuration.dto';
import type {
  DeploymentItemDto,
  DeploymentsResponseDto,
} from './dto/deployment-item.dto';
import type { DeploymentInterfaceType } from './dto/deployments-query.dto';
import { RawDeploymentDto } from './dto/raw-deployment.dto';

const isRecord = (val: unknown): val is Record<string, unknown> =>
  val != null && typeof val === 'object' && !Array.isArray(val);

const toAdditionalProperties = (
  val: unknown,
): boolean | Record<string, unknown> | undefined => {
  if (typeof val === 'boolean') return val;
  if (isRecord(val)) return val;
  return undefined;
};

type RawDeploymentWithFeatures = RawDeploymentDto & {
  features?: { system_prompt?: boolean; temperature?: boolean };
};

const mapToDeploymentItem = (
  raw: RawDeploymentWithFeatures,
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
    const interfaceFilter =
      interfaceType && interfaceType.length > 0 ? interfaceType : undefined;
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
        const result = await this.client.getDeploymentsByInterfaceType({
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

    const filtered = withInstalled.filter(
      (item) =>
        item.interfaces &&
        item.interfaces.some((iface) =>
          interfaceFilter.includes(iface as DeploymentInterfaceType),
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
