import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { DialClientService } from '../../dial/dial-client.service';
import { DeploymentItemType } from '../dto/deployment-item.dto';
import type { DeploymentItemDto } from '../dto/deployment-item.dto';
import { RawDeploymentDto } from '../dto/raw-deployment.dto';
import { mapToDeploymentItem } from '../utils/deployment-mapper.util';

@Injectable()
export class DeploymentsLookupService {
  private readonly logger = new Logger(DeploymentsLookupService.name);
  private readonly featuredIds: Set<string>;
  private readonly hiddenTags: Set<string>;

  constructor(
    private readonly dialClient: DialClientService,
    configService: ConfigService<EnvironmentVariables>,
  ) {
    this.featuredIds = new Set(
      configService.get<string[]>('FEATURED_MODEL_IDS') ?? [],
    );

    this.hiddenTags = new Set(
      configService.get<string[]>('HIDDEN_ENTITY_TAGS') ?? [],
    );
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
   * Resolves every resource of the given type shared with the current user
   * (READ or WRITE). Best-effort: a DIAL Core error here degrades to
   * "nothing shared" rather than failing the whole lookup. Duplicated from
   * `DeploymentsListingService` rather than shared, matching this class's
   * existing `featuredIds`/`hiddenTags` duplication — Lookup and Listing are
   * deliberately independent sub-services.
   */
  private async getSharedResources(
    accessToken: string,
    resourceType: 'APPLICATION' | 'TOOL_SET',
  ): Promise<{ url?: string; permissions?: string[] }[]> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getSharedResources({
          headers: getBearerAuthHeaders(accessToken),
          body: { resourceTypes: [resourceType], with: 'me' },
        });
      if (error) {
        this.logger.warn(
          `Failed to resolve shared ${resourceType} resources: status=${response.status}`,
        );
        return [];
      }

      return (data?.resources ?? []) as {
        url?: string;
        permissions?: string[];
      }[];
    } catch (err) {
      this.logger.warn(
        `Failed to resolve shared ${resourceType} resources`,
        err,
      );
      return [];
    }
  }

  private async getSharedResourceUrlSets(
    accessToken: string,
    resourceType: 'APPLICATION' | 'TOOL_SET',
  ): Promise<ResourceOwnershipUrlSets> {
    const resources = await this.getSharedResources(accessToken, resourceType);
    return splitResourcesByPermission(resources);
  }

  /**
   * Resolves a single model or application by id into list-item shape
   * (`DeploymentItemDto`), for contexts that already know a specific id and
   * don't want to depend on a full `listDeployments` call — e.g. right after
   * accepting a share invitation, where waiting for the bulk list to reflect
   * a just-granted share is an unbounded race against DIAL Core's own
   * propagation. Unprefixed ids try model then application, mirroring
   * `DeploymentsDetailsService.fetchDeploymentDetails`'s ambiguous-id
   * fallback. `toolsets/`-prefixed ids are not resolved here — callers
   * should use `ToolsetsService.resolveToolsetItem` for those, and for
   * ambiguous ids that turn out not to be a model or application either.
   * `bucket` enriches the result with `isMy`/`canEdit`/`sharedWithMe`, the
   * same ownership fields `DeploymentsListingService.listDeployments`
   * computes — without this, a just-accepted share resolves with those
   * flags `undefined` and the UI keeps showing the raw owner bucket path
   * instead of a "Shared with me" label until the next full list refresh.
   *
   * Returns `null` (not a thrown exception) when DIAL Core has no match —
   * only a genuine upstream error (5xx, network, timeout) propagates as an
   * exception.
   */
  async resolveDeploymentItem(
    deployment: string,
    accessToken: string,
    bucket: string,
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
      const item = mapToDeploymentItem(raw, this.featuredIds, this.hiddenTags);
      if (item == null) return null;

      /*
       * getSharedResources is scoped to one resourceType per call, and
       * resolveDeploymentItem only ever resolves a model or an application
       * (never a toolset — see the early `toolsets/` return above), so a
       * model item can never appear in either URL set — skip the upstream
       * round-trip entirely for non-application items.
       */
      const urlSets =
        item.type === DeploymentItemType.Application
          ? await this.getSharedResourceUrlSets(accessToken, 'APPLICATION')
          : { writableUrls: new Set<string>(), sharedUrls: new Set<string>() };

      return {
        ...item,
        ...computeItemOwnershipFlags(item.id, bucket, urlSets),
      };
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
}
