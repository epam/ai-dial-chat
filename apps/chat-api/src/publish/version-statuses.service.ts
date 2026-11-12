import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { getVersionGroupId } from '../common/utils/version-group';
import { DeploymentsService } from '../deployments/deployments.service';
import { DeploymentItemType } from '../deployments/dto/deployment-item.dto';
import { ToolsetsListingService } from '../toolsets/listing/toolsets-listing.service';
import { CatalogEntityType } from './dto/catalog-entity-params.dto';
import {
  VersionPublicationStatus,
  VersionStatusEntryDto,
} from './dto/version-status-entry.dto';
import { getResourceBucket } from './publish-target.util';
import { PublishService } from './publish.service';
import { resolveVersionStatus } from './version-status.util';

interface VersionItem {
  id: string;
  displayVersion?: string;
}

/** Reports the publication status of every saved version of an application or toolset. */
@Injectable()
export class VersionStatusesService {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly toolsetsListingService: ToolsetsListingService,
    private readonly publishService: PublishService,
  ) {}

  /**
   * Statuses of every version in the entity's version group (same owner
   * bucket, same folder, same base name), in listing order. The group comes
   * from the unfiltered cached listing; the caller's publications are read
   * once. A resource owned by another user answers `unknown` for every version.
   * @param userSub - session user the listings are cached under
   * @param accessToken - bearer token for DIAL Core
   * @param bucket - the caller's own bucket
   * @param entityType - application or toolset
   * @param entityId - resource id of any version of the entity
   * @throws {BadRequestException} When the entity type has no versions
   * @throws {NotFoundException} When no version of the entity is listed
   */
  async getVersionStatuses(
    userSub: string,
    accessToken: string,
    bucket: string,
    entityType: CatalogEntityType,
    entityId: string,
  ): Promise<VersionStatusEntryDto[]> {
    const versions = await this.listGroupVersions(
      userSub,
      accessToken,
      bucket,
      entityType,
      entityId,
    );
    if (versions.length === 0) {
      throw new NotFoundException('No version of this entity was found');
    }

    const ownerBucket = getResourceBucket(entityId);
    if (!bucket || ownerBucket !== bucket) {
      return versions.map((item) => ({
        id: item.id,
        version: item.displayVersion ?? '',
        status: VersionPublicationStatus.Unknown,
        publishedFolders: [],
      }));
    }

    const publications = await this.publishService.getBucketPublications(
      accessToken,
      bucket,
    );
    return versions.map((item) => ({
      id: item.id,
      version: item.displayVersion ?? '',
      ...resolveVersionStatus(publications, item.id),
    }));
  }

  private async listGroupVersions(
    userSub: string,
    accessToken: string,
    bucket: string,
    entityType: CatalogEntityType,
    entityId: string,
  ): Promise<VersionItem[]> {
    let items: VersionItem[];
    if (entityType === CatalogEntityType.Application) {
      const { deployments } = await this.deploymentsService.listDeployments(
        userSub,
        accessToken,
        bucket,
      );
      items = deployments.filter(
        (item) => item.type === DeploymentItemType.Application,
      );
    } else if (entityType === CatalogEntityType.Toolset) {
      const { data } = await this.toolsetsListingService.listToolsets(
        userSub,
        accessToken,
        bucket,
      );
      items = data;
    } else {
      throw new BadRequestException(
        `Entity type "${entityType}" has no versions`,
      );
    }

    const groupId = getVersionGroupId(entityId);
    const ownerBucket = getResourceBucket(entityId);
    const decodedEntityId = safeDecodeURIComponent(entityId);
    return items.filter((item) => {
      if (groupId == null) {
        return safeDecodeURIComponent(item.id) === decodedEntityId;
      }
      return (
        getVersionGroupId(item.id) === groupId &&
        getResourceBucket(item.id) === ownerBucket
      );
    });
  }
}
