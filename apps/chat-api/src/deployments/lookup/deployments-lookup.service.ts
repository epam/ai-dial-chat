import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
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
}
