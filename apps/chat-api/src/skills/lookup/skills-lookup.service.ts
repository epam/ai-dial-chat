import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import type { SkillMetadataItemDto } from '../dto/skill-metadata.dto';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import {
  type DialMetadataBase,
  mapToSkillMetadataItem,
} from '../utils/skill-metadata.util';
import { parseSkillResourceUrl } from '../utils/skill-path.util';

const WRITE_PERMISSION = 'WRITE';

const hasWritePermission = (permissions: string[] | undefined): boolean =>
  permissions?.includes(WRITE_PERMISSION) ?? false;

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

  /**
   * Resolves a single skill by its full `skills/{bucket}/{path}` resource
   * URL. Returns `null` for anything that isn't a genuine match — an
   * `itemId` that isn't a well-formed skill URL, or a DIAL Core 404 — so
   * callers can treat "not a skill"/"not found" the same way. Only a
   * genuine upstream error (5xx, network, timeout) propagates as an
   * exception.
   */
  /*
   * `callerBucket` mirrors `DeploymentsLookupService.resolveDeploymentItem`'s
   * `bucket` parameter and, together with `grantedPermissions`, enriches the
   * result with the same `isMy`/`canEdit`/`sharedWithMe` ownership fields
   * `SkillsListingService.listCatalogSkills` computes. Without them a
   * just-accepted share resolves with `canEdit` undefined, and the
   * frontend's `mapSkillToCatalogItem` (`skill.canEdit ?? isPersonal`) then
   * renders an edit-shared skill read-only — overwriting, through
   * `mergeSharedSkill`, the correctly-flagged entry the post-accept refetch
   * had just produced (GH #8839).
   *
   * `grantedPermissions` come from the invitation itself rather than from a
   * `getSharedResources` round-trip: the invitation is what just granted the
   * access, whereas DIAL Core does not guarantee that a shared-resources
   * listing issued immediately after an accept already reflects the grant —
   * the same propagation race this post-accept summary exists to avoid. The
   * resolved metadata's own `permissions` are consulted as a second source,
   * for a caller who already held WRITE before this invitation.
   *
   * A resolved skill URL naming a different bucket than the caller's own is
   * still a valid lookup target (a skill owned by another user) — the lookup
   * always proceeds against the URL's own `parsed.bucket`.
   */
  async resolveSkillItem(
    itemId: string,
    accessToken: string,
    callerBucket?: string,
    grantedPermissions?: string[],
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
            signal: AbortSignal.timeout(
              getSkillTransferTimeoutMs(this.configService),
            ),
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

      const item = mapToSkillMetadataItem(data as DialMetadataBase);
      if (item == null) return null;

      /*
       * This lookup is only reached for a skill the caller was just invited
       * to, so a bucket that is not the caller's own is by construction
       * another user's — "shared with me", never the public namespace.
       */
      const isMy =
        callerBucket != null &&
        safeDecodeURIComponent(parsed.bucket) ===
          safeDecodeURIComponent(callerBucket);

      return {
        ...item,
        isMy,
        canEdit:
          isMy ||
          hasWritePermission(grantedPermissions) ||
          hasWritePermission(item.permissions),
        sharedWithMe: !isMy,
      };
    } catch (err) {
      return handleDialSdkError(
        err,
        `resolve skill item "${itemId}"`,
        this.logger,
      );
    }
  }
}
