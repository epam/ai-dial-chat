import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import {
  computeItemOwnershipFlags,
  splitResourcesByPermission,
  type ResourceOwnershipUrlSets,
} from '../../common/utils/resource-ownership';
import { DeploymentsDetailsService } from '../../deployments/details/deployments-details.service';
import { DialClientService } from '../../dial/dial-client.service';
import type {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '../../openapi/openapi-response.dto';
import { UserConfigService } from '../../user-config/user-config.service';
import {
  isVisibleToolset,
  mapDialToolsetToDto,
  mergeCustomToolsetDetails,
  parseDialToolsetResource,
  type DialToolsetResource,
  type RawDialToolset,
} from '../utils/toolset-mapper.util';

@Injectable()
export class ToolsetsListingService {
  private readonly logger = new Logger(ToolsetsListingService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly userConfigService: UserConfigService,
    private readonly deploymentsDetailsService: DeploymentsDetailsService,
  ) {}

  private enrichToolsetWithOwnership(
    toolset: DialToolsetDto,
    installedIdSet: Set<string>,
    bucket: string,
    urlSets: ResourceOwnershipUrlSets,
  ): DialToolsetDto {
    return {
      ...toolset,
      isInstalled: installedIdSet.has(toolset.id),
      ...computeItemOwnershipFlags(toolset.id, bucket, urlSets),
    };
  }

  /**
   * Resolves every toolset resource shared with the current user (READ or
   * WRITE), in a single upstream call reused to derive both the WRITE-only
   * "can edit" set and the unfiltered "shared with me" set — avoids issuing
   * `getSharedResources` twice per list/get request. Best-effort: a DIAL
   * Core error here degrades to "no shared toolsets" rather than failing the
   * whole request.
   */
  private async getSharedToolsetResources(
    accessToken: string,
  ): Promise<{ url?: string; permissions?: string[] }[]> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getSharedResources({
          headers: getBearerAuthHeaders(accessToken),
          body: { resourceTypes: ['TOOL_SET'], with: 'me' },
        });
      if (error) {
        this.logger.warn(
          `Failed to resolve shared toolset resources: status=${response.status}`,
        );
        return [];
      }

      return (data?.resources ?? []) as {
        url?: string;
        permissions?: string[];
      }[];
    } catch (err) {
      this.logger.warn('Failed to resolve shared toolset resources', err);
      return [];
    }
  }

  private async enrichToolsetsOwnership(
    toolsets: DialToolsetDto[],
    accessToken: string,
    bucket: string,
  ): Promise<DialToolsetDto[]> {
    const [{ toolsets: installedIds }, sharedResources] = await Promise.all([
      this.userConfigService.getInstalledIds(accessToken, bucket),
      this.getSharedToolsetResources(accessToken),
    ]);
    const installedSet = new Set(installedIds);
    const urlSets = splitResourcesByPermission(sharedResources);
    return toolsets.map((toolset) =>
      this.enrichToolsetWithOwnership(toolset, installedSet, bucket, urlSets),
    );
  }

  private async getOpenAiToolset(
    accessToken: string,
    toolsetName: string,
  ): Promise<RawDialToolset> {
    const result = await this.dialClient.client.getToolset(toolsetName, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get toolset "${toolsetName}"`,
        this.logger,
      );
    }
    return result.data as unknown as RawDialToolset;
  }

  private async tryGetOpenAiToolset(
    accessToken: string,
    toolsetName: string,
  ): Promise<RawDialToolset | undefined> {
    try {
      return await this.getOpenAiToolset(accessToken, toolsetName);
    } catch (err) {
      this.logger.debug(
        `Skipped extended toolset details for "${toolsetName}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  private async getCustomToolset(
    accessToken: string,
    toolsetName: string,
    resource: DialToolsetResource,
  ): Promise<RawDialToolset> {
    const result = await this.dialClient.client.getCustomToolSet(
      resource.bucket,
      resource.path,
      {
        headers: getBearerAuthHeaders(accessToken),
      },
    );
    if (result.error) {
      if (result.response.status === 404) {
        return this.getOpenAiToolset(accessToken, toolsetName);
      }
      return mapDialHttpStatus(
        result.response.status,
        `get custom toolset "${toolsetName}"`,
        this.logger,
      );
    }

    const extendedToolset = await this.tryGetOpenAiToolset(
      accessToken,
      toolsetName,
    );
    return mergeCustomToolsetDetails(
      result.data as unknown as RawDialToolset,
      toolsetName,
      extendedToolset,
    );
  }

  async listToolsets(
    userSub: string,
    accessToken: string,
    bucket: string,
  ): Promise<DialToolsetListResponseDto> {
    const cacheKey = `toolsets:list:${userSub}`;
    const cached =
      await this.cacheManager.get<DialToolsetListResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for toolsets list (sub: ${userSub})`);
      return {
        data: await this.enrichToolsetsOwnership(
          cached.data,
          accessToken,
          bucket,
        ),
      };
    }

    try {
      const result = await this.dialClient.client.getToolSets({
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          'list toolsets',
          this.logger,
        );
      }
      const { data: toolsets } = result.data as unknown as {
        data: RawDialToolset[];
      };
      const data: DialToolsetListResponseDto = {
        data: (toolsets ?? [])
          .filter(isVisibleToolset)
          .map(mapDialToolsetToDto),
      };
      await this.cacheManager.set(cacheKey, data, 30 * 1000);
      return {
        data: await this.enrichToolsetsOwnership(
          data.data,
          accessToken,
          bucket,
        ),
      };
    } catch (err) {
      return handleDialFetchError(err, 'list toolsets', this.logger, 0);
    }
  }

  async getToolset(
    userSub: string,
    accessToken: string,
    bucket: string,
    toolsetName: string,
  ): Promise<DialToolsetDto> {
    const cacheKey = `toolsets:single:${userSub}:${toolsetName}`;

    const enrich = async (toolset: DialToolsetDto): Promise<DialToolsetDto> => {
      const [{ toolsets: installedIds }, sharedResources] = await Promise.all([
        this.userConfigService.getInstalledIds(accessToken, bucket),
        this.getSharedToolsetResources(accessToken),
      ]);
      const urlSets = splitResourcesByPermission(sharedResources);
      return this.enrichToolsetWithOwnership(
        toolset,
        new Set(installedIds),
        bucket,
        urlSets,
      );
    };

    const cached = await this.cacheManager.get<DialToolsetDto>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for toolset "${toolsetName}" (sub: ${userSub})`,
      );
      return enrich(cached);
    }

    try {
      const resource = parseDialToolsetResource(toolsetName);
      const rawToolset =
        resource == null
          ? await this.getOpenAiToolset(accessToken, toolsetName)
          : await this.getCustomToolset(accessToken, toolsetName, resource);
      const data = mapDialToolsetToDto(rawToolset);
      await this.cacheManager.set(cacheKey, data, 60 * 1000);
      return enrich(data);
    } catch (err) {
      return handleDialFetchError(
        err,
        `get toolset "${toolsetName}"`,
        this.logger,
        0,
      );
    }
  }

  /**
   * Resolves a single toolset by id for contexts that don't already have the
   * caller's bucket at hand — e.g. right after accepting a share invitation,
   * where waiting for the bulk toolsets list to reflect a just-granted share
   * is an unbounded race against DIAL Core's own propagation. Reuses
   * `getToolset`'s existing resource resolution/ownership-enrichment; only
   * resolves the caller's own bucket first, which `getToolset` needs for the
   * `isMy`/`canEdit` ownership fields.
   *
   * Returns `null` (not a thrown exception) when DIAL Core has no match for
   * this id — only a genuine upstream error (5xx, network, timeout)
   * propagates as an exception.
   */
  async resolveToolsetItem(
    userSub: string,
    accessToken: string,
    toolsetName: string,
  ): Promise<DialToolsetDto | null> {
    try {
      const bucket = await this.getUserBucket(
        getBearerAuthHeaders(accessToken),
        `resolve toolset item "${toolsetName}"`,
      );
      return await this.getToolset(userSub, accessToken, bucket, toolsetName);
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  /**
   * Clears the toolsets caches for a user, and (when a specific toolset
   * changed) the deployments-details cache entry that surfaces its auth
   * status — called by `ToolsetsMutationService`/`ToolsetsAuthService`
   * after every write.
   */
  async invalidateCaches(userSub: string, toolsetName?: string): Promise<void> {
    await this.cacheManager.del(`toolsets:list:${userSub}`);
    if (toolsetName != null) {
      await this.cacheManager.del(`toolsets:single:${userSub}:${toolsetName}`);
      /*
       * The details panel reads toolset auth status through
       * `DeploymentsDetailsService.getDeploymentDetails`, which caches
       * independently of the toolsets caches above — without this, a
       * login/logout leaves that panel showing the pre-change credential
       * status for up to 60s.
       */
      await this.deploymentsDetailsService.invalidateDetailsCache(
        userSub,
        toolsetName,
      );
    }
  }

  /**
   * Evicts the cached toolsets list for a user so the next `listToolsets`
   * call re-fetches from DIAL Core instead of serving a stale snapshot —
   * e.g. right after the user accepted a share invitation granting access to
   * a new toolset.
   */
  async invalidateListCache(userSub: string): Promise<void> {
    await this.invalidateCaches(userSub);
  }

  async getUserBucket(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    context: string,
  ): Promise<string> {
    const result = await this.dialClient.client.getUserBucket({
      headers: authHeaders,
    });
    if (result.error) {
      return mapDialHttpStatus(result.response.status, context, this.logger);
    }
    const { bucket } = result.data ?? {};
    if (bucket == null) {
      throw new BadGatewayException('DIAL Core returned an empty bucket');
    }
    return bucket;
  }

  async resolveToolsetResource(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    toolsetName: string,
  ): Promise<DialToolsetResource> {
    const resource = parseDialToolsetResource(toolsetName);
    if (resource != null) {
      return resource;
    }

    return {
      bucket: await this.getUserBucket(authHeaders, 'get user bucket'),
      path: encodeDialResourcePath(toolsetName),
    };
  }
}
