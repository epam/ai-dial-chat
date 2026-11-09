import { Injectable } from '@nestjs/common';
import {
  ResourceIdentityTab,
  buildResourceNameConflict,
  findDuplicateIdentity,
  type ResourceIdentityCandidate,
} from '../common/utils/resource-identity';
import { toResourceIdentityEntries } from '../common/utils/resource-identity-sources';
import { DeploymentsService } from '../deployments/deployments.service';
import type { DeploymentItemDto } from '../deployments/dto/deployment-item.dto';
import type { DialToolsetDto } from '../openapi/openapi-response.dto';
import { ToolsetsListingService } from '../toolsets/listing/toolsets-listing.service';

/** Inputs of {@link ResourceIdentityService.assertUnique}. */
export interface AssertUniqueParams {
  /** Session user the lists are cached under. */
  userSub: string;
  /** Bearer token for DIAL Core. */
  accessToken: string;
  /** The caller's own bucket. */
  bucket: string;
  /** Identity the write is about to apply. */
  candidate: ResourceIdentityCandidate;
  /** Catalog tabs the written entity appears in. */
  tabs: ResourceIdentityTab[];
  /** Id of the entity being rewritten, skipped in the comparison. */
  selfId?: string;
  /** Fresh deployments the caller already read; read here when omitted. */
  deployments?: DeploymentItemDto[];
  /** Fresh toolsets the caller already read; read here when omitted. */
  toolsets?: DialToolsetDto[];
}

/**
 * The one place that decides whether a write would duplicate the displayed
 * name and version of another own entity. Lists are always read fresh, because
 * a duplicate may be seconds old.
 */
@Injectable()
export class ResourceIdentityService {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly toolsetsListingService: ToolsetsListingService,
  ) {}

  /**
   * Reads the caller's deployments from DIAL Core, bypassing the cache.
   * @param userSub - session user the list is cached under
   * @param accessToken - bearer token for DIAL Core
   * @param bucket - the caller's own bucket
   */
  async listFreshDeployments(
    userSub: string,
    accessToken: string,
    bucket: string,
  ): Promise<DeploymentItemDto[]> {
    const { deployments } = await this.deploymentsService.listDeployments(
      userSub,
      accessToken,
      bucket,
      undefined,
      true,
    );
    return deployments;
  }

  /**
   * Reads the caller's toolsets from DIAL Core, bypassing the cache.
   * @param userSub - session user the list is cached under
   * @param accessToken - bearer token for DIAL Core
   * @param bucket - the caller's own bucket
   */
  async listFreshToolsets(
    userSub: string,
    accessToken: string,
    bucket: string,
  ): Promise<DialToolsetDto[]> {
    const { data } = await this.toolsetsListingService.listToolsets(
      userSub,
      accessToken,
      bucket,
      true,
    );
    return data;
  }

  /**
   * Throws the coded `409` when `candidate` matches another own entity in the
   * given tabs and folder. Toolsets are read only for the Toolsets tab.
   * @param params - candidate identity, tabs to compare in and any lists already read
   */
  async assertUnique(params: AssertUniqueParams): Promise<void> {
    const { userSub, accessToken, bucket, candidate, tabs, selfId } = params;
    const [deployments, toolsets] = await Promise.all([
      params.deployments ??
        this.listFreshDeployments(userSub, accessToken, bucket),
      params.toolsets ??
        (tabs.includes(ResourceIdentityTab.Toolsets)
          ? this.listFreshToolsets(userSub, accessToken, bucket)
          : []),
    ]);
    const duplicate = findDuplicateIdentity({
      candidate,
      tabs,
      entries: toResourceIdentityEntries(deployments, toolsets),
      selfId,
    });
    if (duplicate) throw buildResourceNameConflict(duplicate, tabs);
  }
}
