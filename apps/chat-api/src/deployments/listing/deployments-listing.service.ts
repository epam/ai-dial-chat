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
import {
  computeItemOwnershipFlags,
  splitResourcesByPermission,
  type ResourceOwnershipUrlSets,
} from '../../common/utils/resource-ownership';
import type { EnvironmentVariables } from '../../config/environment.config';
import { HIDDEN_FILE } from '../../constants/dial.constants';
import { DialClientService } from '../../dial/dial-client.service';
import { UserConfigService } from '../../user-config/user-config.service';
import { DeploymentItemType } from '../dto/deployment-item.dto';
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
   * Resolves every APPLICATION-type resource shared with the current user
   * (READ or WRITE). Toolsets never appear in this list's items (see
   * `listDeployments`), so only the APPLICATION scope is needed here — a
   * TOOL_SET-scoped equivalent lives in `DeploymentsLookupService` for
   * single-toolset lookups. Best-effort: a DIAL Core error here degrades to
   * "nothing shared" rather than failing the whole deployments list.
   */
  private async getSharedResources(
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
          `Failed to resolve shared APPLICATION resources: status=${response.status}`,
        );
        return [];
      }

      return (data?.resources ?? []) as {
        url?: string;
        permissions?: string[];
      }[];
    } catch (err) {
      this.logger.warn('Failed to resolve shared APPLICATION resources', err);
      return [];
    }
  }

  /**
   * Splits `getSharedResources`'s flat resource list into the two URL sets
   * ownership enrichment needs.
   */
  private async getSharedResourceUrlSets(
    accessToken: string,
  ): Promise<ResourceOwnershipUrlSets> {
    const resources = await this.getSharedResources(accessToken);
    return splitResourcesByPermission(resources);
  }

  async listDeployments(
    userSub: string,
    accessToken: string,
    bucket: string,
    interfaceType?: DeploymentInterfaceType[],
    refresh = false,
  ): Promise<DeploymentsResponseDto> {
    this.logger.debug(
      `listDeployments requested interfaceType=${JSON.stringify(interfaceType)} (sub: ${userSub})`,
    );
    const baseCacheKey = `deployments:list:${userSub}`;
    const normalizedTypes = interfaceType?.filter(
      (t) => t !== DeploymentInterfaceType.All,
    );
    const interfaceFilter = (
      normalizedTypes && normalizedTypes.length > 0
        ? normalizedTypes
        : undefined
    ) as DialDeploymentInterfaceType[] | undefined;
    this.logger.debug(
      `Normalized interfaceFilter=${JSON.stringify(interfaceFilter)} (sub: ${userSub})`,
    );
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
        this.logger.debug(
          `Requesting deployments from DIAL Core with interface_type=${JSON.stringify(interfaceFilter)} (sub: ${userSub})`,
        );
        const result = await this.dialClient.client.listDeployments({
          headers: getBearerAuthHeaders(accessToken),
          params: interfaceFilter
            ? { query: { interface_type: interfaceFilter } }
            : undefined,
          /*
           * DIAL Core documents `interface_type` as accepting a
           * comma-separated list; openapi-fetch's default array serialization
           * sends repeated keys (`interface_type=chat&interface_type=mcp`)
           * instead, which Core does not parse as multiple values.
           */
          querySerializer: { array: { style: 'form', explode: false } },
        });
        this.logger.debug(
          `DIAL Core request URL: ${result.response.url} (sub: ${userSub})`,
        );
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

        const mappedItems = rawItems
          .filter((item) => item.id && !item.id.includes(HIDDEN_FILE))
          .map((item) =>
            mapToDeploymentItem(item, this.featuredIds, this.hiddenTags),
          )
          .filter((item): item is DeploymentItemDto => item !== null);

        /*
         * DIAL Core's /v1/deployments can include toolset entries (e.g. when
         * filtering by the `mcp` interface), but its payload for them is a
         * thinner subset than the dedicated /v1/toolsets listing — notably
         * missing `auth_settings`/`endpoint` — which the toolset catalog
         * card needs for auth-status display. Toolsets are served
         * exclusively via ToolsetsListingService/`/v1/toolsets`; drop them
         * here rather than surface an incomplete duplicate.
         */
        allItems = mappedItems.filter(
          (item) => item.type !== DeploymentItemType.Toolset,
        );
        this.logger.debug(
          `DIAL Core /v1/deployments returned ${mappedItems.length} items (${mappedItems.length - allItems.length} toolsets dropped) (sub: ${userSub})`,
        );

        await this.cacheManager.set(cacheKey, allItems, 30_000);
      } catch (err) {
        return handleDialFetchError(err, 'list deployments', this.logger, 0);
      }
    }

    const { deployments: deploymentIds } =
      await this.userConfigService.getInstalledIds(accessToken, bucket);
    const deploymentsSet = new Set(deploymentIds);
    const applicationUrlSets = await this.getSharedResourceUrlSets(accessToken);

    const withInstalled = allItems.map((item) => ({
      ...item,
      isInstalled: deploymentsSet.has(item.id),
      ...computeItemOwnershipFlags(item.id, bucket, applicationUrlSets),
    }));

    if (!interfaceFilter) {
      return { deployments: withInstalled };
    }

    /*
     * TODO: this local re-filter compensates for DIAL Core not reliably
     * filtering by interface_type server-side. Once Core fixes this
     * (https://github.com/epam/ai-dial-core/issues/1822), filtering will
     * happen on Core's side and this step can likely be simplified/removed.
     */
    const filtered = withInstalled.filter((item) =>
      item.interfaces?.some((iface) =>
        interfaceFilter.includes(iface as DialDeploymentInterfaceType),
      ),
    );
    this.logger.debug(
      `Local interface filter applied: ${withInstalled.length} -> ${filtered.length} items (filter=${JSON.stringify(interfaceFilter)}, sub: ${userSub})`,
    );
    return { deployments: filtered };
  }
}
