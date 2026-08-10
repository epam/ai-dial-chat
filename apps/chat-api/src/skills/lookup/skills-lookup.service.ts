import type { components } from '@epam/ai-dial-typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import type { SkillMetadataItemDto } from '../dto/skill-metadata.dto';
import { SkillNodeType } from '../dto/skill-node-type';
import { parseSkillResourceUrl } from '../utils/skill-path.util';

type DialMetadataBase = components['schemas']['MetadataBase'];

const mapToSkillMetadataItem = (
  item: DialMetadataBase,
): SkillMetadataItemDto | null => {
  const nodeType =
    item.nodeType === 'FOLDER'
      ? SkillNodeType.Folder
      : item.nodeType === 'ITEM'
        ? SkillNodeType.Item
        : null;
  if (nodeType == null || item.bucket == null || item.name == null) {
    return null;
  }

  const path =
    item.parentPath != null ? `${item.parentPath}${item.name}` : item.name;

  return {
    name: item.name,
    path: nodeType === SkillNodeType.Folder ? `${path}/` : path,
    url: item.url ?? `skills/${item.bucket}/${path}`,
    bucket: item.bucket,
    nodeType,
    parentPath: item.parentPath,
    permissions: item.permissions,
    etag: 'etag' in item ? item.etag : undefined,
    author: 'author' in item ? item.author : undefined,
    createdAt: 'createdAt' in item ? item.createdAt : undefined,
    updatedAt: 'updatedAt' in item ? item.updatedAt : undefined,
  };
};

/**
 * Resolves one skill from a `skills/{bucket}/{path}` resource URL into a
 * normalized single-skill DTO, mirroring
 * `DeploymentsLookupService.resolveDeploymentItem` — for
 * `ShareService.acceptInvitation`'s post-accept summary resolution
 * (design.md D9). Deliberately not on the `SkillsService` facade; consumers
 * inject this service directly.
 */
@Injectable()
export class SkillsLookupService {
  private readonly logger = new Logger(SkillsLookupService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getTimeoutMs(): number {
    return (
      this.configService.get<number>('SKILL_TRANSFER_TIMEOUT_MS') ?? 60_000
    );
  }

  /**
   * Resolves a single skill by its full `skills/{bucket}/{path}` resource
   * URL. Returns `null` for anything that isn't a genuine match — an
   * `itemId` that isn't a well-formed skill URL, or a DIAL Core 404 — so
   * callers can treat "not a skill"/"not found" the same way. Only a
   * genuine upstream error (5xx, network, timeout) propagates as an
   * exception.
   */
  /*
   * `_callerBucket` mirrors `DeploymentsLookupService.resolveDeploymentItem`'s
   * `bucket` parameter shape for interface consistency across lookup
   * services, but is currently unused here: `SkillMetadataItemDto` has no
   * `isMy`/`canEdit`/`sharedWithMe` ownership fields the way
   * `DeploymentItemDto` does (skills carry their own `permissions` array
   * directly from DIAL Core instead), so there is nothing to compute
   * against it yet. A resolved skill URL naming a different bucket than the
   * caller's own is still a valid lookup target (e.g. a shared skill owned
   * by another user) — the lookup always proceeds against the URL's own
   * `parsed.bucket`.
   */
  async resolveSkillItem(
    itemId: string,
    accessToken: string,
    _callerBucket?: string,
  ): Promise<SkillMetadataItemDto | null> {
    const parsed = parseSkillResourceUrl(itemId);
    if (parsed == null) return null;

    try {
      const { data, error, response } =
        await this.dialClient.client.listSkillMetadata(
          parsed.bucket,
          encodeDialResourcePath(parsed.path),
          {
            headers: getBearerAuthHeaders(accessToken),
            signal: AbortSignal.timeout(this.getTimeoutMs()),
          },
        );

      if (error != null) {
        if (response.status === 404) return null;
        return handleDialSdkError(
          error,
          `resolve skill item "${itemId}"`,
          this.logger,
          response,
        );
      }
      if (data == null) return null;

      return mapToSkillMetadataItem(data as DialMetadataBase);
    } catch (err) {
      return handleDialSdkError(
        err,
        `resolve skill item "${itemId}"`,
        this.logger,
      );
    }
  }
}
