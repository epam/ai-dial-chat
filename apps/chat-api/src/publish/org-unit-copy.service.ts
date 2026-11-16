import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import { handleDialFetchError } from '../common/dial/dial-error.mapper';
import type { ResourceIdResponseDto } from '../common/dto/resource-folder.dto';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import {
  DialResourceType,
  assertOwnBucket,
  buildFolderResourcePath,
  getResourceLeaf,
  transferDialResource,
  type DialResourceLocation,
} from '../common/utils/dial-resource-transfer';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import { parsePromptId } from '../prompts/utils/prompt-mapper.util';
import { parseSkillResourceUrl } from '../skills/utils/skill-path.util';
import { ToolsetsListingService } from '../toolsets/listing/toolsets-listing.service';
import { CatalogEntityType } from './dto/catalog-entity-params.dto';
import type { CopyCatalogEntityToOrgUnitDto } from './dto/copy-catalog-entity-to-org-unit.dto';

/**
 * What differs per entity type when an own resource is copied into an org-unit
 * folder: how `entityId` resolves to the caller's own copy, and which caches
 * the write makes stale. The copy itself is the same DIAL Core call for every
 * type.
 */
interface OrgUnitCopyType {
  /** Resource type of the Core urls. */
  resourceType: DialResourceType;
  /** Resolves `entityId` to a resource of the caller's own bucket; throws when it lies elsewhere. */
  resolveOwn: (
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    entityId: string,
  ) => Promise<DialResourceLocation>;
  /** Clears the caches the write made stale. */
  invalidate: (
    userSub: string,
    entityId: string,
    copyId: string,
    context: string,
  ) => Promise<void>;
}

/**
 * Copies a catalog entity of the caller's own bucket into a folder of the
 * public bucket (an org-unit folder), without a publication request. Every
 * right and per-type rule is DIAL Core's: its 403 and 409 reach the caller as
 * they are. The per-type differences live in {@link OrgUnitCopyService.getType}
 * only; types without an entry answer 501 until they are added there.
 */
@Injectable()
export class OrgUnitCopyService {
  private readonly logger = new Logger(OrgUnitCopyService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly applicationsService: ApplicationsService,
    private readonly toolsetsListingService: ToolsetsListingService,
  ) {}

  /**
   * @param userSub - session user whose caches are cleared
   * @param accessToken - bearer token for DIAL Core
   * @param entityType - catalog entity kind of `entityId`
   * @param entityId - own resource: a bare name or full id for applications and toolsets, the full `{type}/{bucket}/{path}` id for prompts and skills (a bare name answers 400)
   * @param body - destination folder and whether to replace an existing target
   * @returns the full id of the copy in the public bucket
   * @throws {NotImplementedException} When the entity type has no org-unit copy yet
   * @throws {ForbiddenException} When the entity is not in the caller's own bucket or Core refuses the write
   * @throws {ConflictException} When the target exists and `overwrite` is not set, or Core refuses the copy as a conflict
   */
  async copyIntoOrgUnit(
    userSub: string,
    accessToken: string,
    entityType: CatalogEntityType,
    entityId: string,
    body: CopyCatalogEntityToOrgUnitDto,
  ): Promise<ResourceIdResponseDto> {
    const copyType = this.getType(entityType);
    const authHeaders = getBearerAuthHeaders(accessToken);
    const context = `copy ${entityType} "${entityId}" into an org unit`;
    let id: string;
    try {
      const source = await copyType.resolveOwn(authHeaders, entityId);
      const destination: DialResourceLocation = {
        bucket: PUBLIC_BUCKET,
        path: buildFolderResourcePath(
          body.folderPath,
          getResourceLeaf(source.path),
        ),
      };
      await transferDialResource({
        client: this.dialClient.client,
        operation: 'copyResource',
        type: copyType.resourceType,
        headers: authHeaders,
        source,
        destination,
        context,
        logger: this.logger,
        overwrite: body.overwrite ?? false,
      });
      id = `${copyType.resourceType}/${destination.bucket}/${destination.path}`;
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, 0);
    }

    await copyType.invalidate(userSub, entityId, id, context);
    return { id };
  }

  /** The one place per-type differences are declared. */
  private getType(entityType: CatalogEntityType): OrgUnitCopyType {
    if (entityType === CatalogEntityType.Application) {
      return {
        resourceType: DialResourceType.Applications,
        resolveOwn: (authHeaders, entityId) =>
          this.applicationsService.resolveOwnApplication(authHeaders, entityId),
        invalidate: (userSub, entityId, copyId, context) =>
          this.applicationsService.invalidateAfterWrite(
            userSub,
            [entityId, copyId],
            context,
          ),
      };
    }
    if (entityType === CatalogEntityType.Toolset) {
      return {
        resourceType: DialResourceType.Toolsets,
        resolveOwn: async (authHeaders, entityId) => {
          const resource =
            await this.toolsetsListingService.resolveToolsetResource(
              authHeaders,
              entityId,
            );
          assertOwnBucket(
            resource,
            await this.toolsetsListingService.getUserBucket(
              authHeaders,
              'get user bucket',
            ),
          );
          return resource;
        },
        invalidate: async (userSub, entityId, _copyId, context) => {
          try {
            await this.toolsetsListingService.invalidateCaches(
              userSub,
              entityId,
            );
          } catch (err) {
            handleDialFetchError(
              err,
              `invalidate caches after ${context} (sub: ${userSub})`,
              this.logger,
              0,
              { swallow: true },
            );
          }
        },
      };
    }
    if (entityType === CatalogEntityType.Prompt) {
      return {
        resourceType: DialResourceType.Prompts,
        resolveOwn: async (authHeaders, entityId) => {
          const parsed = parsePromptId(entityId);
          if (parsed == null) {
            throw new BadRequestException(
              'entityId must be a full prompt resource path',
            );
          }
          const resource: DialResourceLocation = {
            bucket: parsed.bucket,
            path: encodeDialResourcePath(parsed.path),
          };
          assertOwnBucket(
            resource,
            await this.toolsetsListingService.getUserBucket(
              authHeaders,
              'get user bucket',
            ),
          );
          return resource;
        },
        /* Prompts are not cached by chat-api, so a copy leaves nothing stale. */
        invalidate: () => Promise.resolve(),
      };
    }
    if (entityType === CatalogEntityType.Skill) {
      return {
        resourceType: DialResourceType.Skills,
        resolveOwn: async (authHeaders, entityId) => {
          const parsed = parseSkillResourceUrl(entityId);
          if (parsed == null) {
            throw new BadRequestException(
              'entityId must be a full skill resource path',
            );
          }
          const resource: DialResourceLocation = {
            bucket: parsed.bucket,
            path: encodeDialResourcePath(parsed.path),
          };
          assertOwnBucket(
            resource,
            await this.toolsetsListingService.getUserBucket(
              authHeaders,
              'get user bucket',
            ),
          );
          return resource;
        },
        /* Skills are not cached by chat-api; the listing is refetched by the host. */
        invalidate: () => Promise.resolve(),
      };
    }
    throw new NotImplementedException(
      `Copying a ${entityType} into an org unit is not supported yet`,
    );
  }
}
