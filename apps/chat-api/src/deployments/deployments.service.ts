import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
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
import type { DeploymentConfigurationDto } from './dto/deployment-configuration.dto';
import type {
  DeploymentItemDto,
  DeploymentsResponseDto,
} from './dto/deployment-item.dto';
import type { DeploymentInterfaceType } from './dto/deployments-query.dto';

const isRecord = (val: unknown): val is Record<string, unknown> =>
  val != null && typeof val === 'object' && !Array.isArray(val);

const toAdditionalProperties = (
  val: unknown,
): boolean | Record<string, unknown> | undefined => {
  if (typeof val === 'boolean') return val;
  if (isRecord(val)) return val;
  return undefined;
};

type RawDeployment = {
  id?: string;
  display_name?: string;
  object?: string;
  toolset?: string;
  icon_url?: string;
  description?: string;
  interfaces?: string | string[];
  application_type_schema_id?: string;
  input_attachment_types?: string[];
};

const mapToDeploymentItem = (raw: RawDeployment): DeploymentItemDto | null => {
  if (!raw.id) return null;

  let type: 'model' | 'application' | 'toolset';
  if (raw.toolset !== undefined) {
    type = 'toolset';
  } else if (raw.object === 'application') {
    type = 'application';
  } else {
    type = 'model';
  }

  console.log('Raw deployment from DIAL Core:', raw); // Debug log to inspect the raw deployment data
  let interfaces: string[] | undefined;
  if (raw.interfaces) {
    if (Array.isArray(raw.interfaces)) {
      interfaces = raw.interfaces;
    } else {
      interfaces = [raw.interfaces];
    }
  }

  return {
    id: raw.id,
    displayName: raw.display_name ?? raw.id,
    type,
    iconUrl: raw.icon_url,
    description: raw.description,
    interfaces,
    applicationTypeSchemaId:
      type === 'application' && raw.application_type_schema_id
        ? raw.application_type_schema_id
        : undefined,
    inputAttachmentTypes: Array.isArray(raw.input_attachment_types)
      ? raw.input_attachment_types
      : undefined,
  };
};

@Injectable()
export class DeploymentsService extends AppService {
  protected override readonly logger = new Logger(DeploymentsService.name);

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super(configService);
  }

  async listDeployments(
    userSub: string,
    accessToken: string,
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
          ? (rawData as RawDeployment[])
          : ((rawData as { deployments?: RawDeployment[] }).deployments ?? []);

        allItems = rawItems
          .filter((item) => item.id && !item.id.includes(HIDDEN_FILE))
          .map(mapToDeploymentItem)
          .filter((item): item is DeploymentItemDto => item !== null);
        await this.cacheManager.set(cacheKey, allItems, 30_000);
      } catch (err) {
        return handleDialFetchError(err, 'list deployments', this.logger, 0);
      }
    }

    if (!interfaceFilter) {
      return { deployments: allItems };
    }

    const filtered = allItems.filter(
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
}
