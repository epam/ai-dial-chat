import type { operations } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import type { EnvironmentVariables } from '../../config/environment.config';
import { HIDDEN_FILE } from '../../constants/dial.constants';
import { DialClientService } from '../../dial/dial-client.service';
import { UserConfigService } from '../../user-config/user-config.service';
import type {
  DeploymentItemDto,
  DeploymentsResponseDto,
} from '../dto/deployment-item.dto';
import { DeploymentInterfaceType } from '../dto/deployments-query.dto';
import { RawDeploymentDto } from '../dto/raw-deployment.dto';
import { mapToDeploymentItem } from '../utils/deployment-mapper.util';

type DialDeploymentInterfaceType = NonNullable<
  NonNullable<
    operations['listDeployments']['parameters']['query']
  >['interface_type']
>[number];

@Injectable()
export class DeploymentsListingService {
  private readonly logger = new Logger(DeploymentsListingService.name);
  private readonly featuredIds: Set<string>;
  private readonly hiddenTags: Set<string>;

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
    refresh = false,
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
    const cached = refresh
      ? undefined
      : ((await this.cacheManager.get<DeploymentItemDto[]>(cacheKey)) ??
        (interfaceFilter
          ? await this.cacheManager.get<DeploymentItemDto[]>(baseCacheKey)
          : undefined));

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
}
