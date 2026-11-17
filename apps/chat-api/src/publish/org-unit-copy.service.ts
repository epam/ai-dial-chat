import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
    userBucket: string,
  ) => Promise<DialResourceLocation>;
  /** Clears the caches the write made stale. */
  invalidate: (
    userSub: string,
    entityId: string,
    copyId: string,
    context: string,
  ) => Promise<void>;
}

/** Prompts and skills keep no cache in chat-api, so a copy leaves nothing stale. */
const NOTHING_TO_INVALIDATE: OrgUnitCopyType['invalidate'] = () =>
  Promise.resolve();

/**
 * Resolver for a type whose `entityId` is always a full `{type}/{bucket}/{path}`
 * id: parses it, answers 400 for anything else, and checks it is the caller's.
 * @param parse - splits the full id into bucket and plain path, or `undefined` when it is not one
 * @param label - the type's name for the 400 message
 */
const resolveOwnFullId =
  (
    parse: (id: string) => { bucket: string; path: string } | null,
    label: string,
  ): OrgUnitCopyType['resolveOwn'] =>
  (_authHeaders, entityId, userBucket) => {
    const parsed = parse(entityId);
    if (parsed == null) {
      throw new BadRequestException(
        `entityId must be a full ${label} resource path`,
      );
    }
    const resource: DialResourceLocation = {
      bucket: parsed.bucket,
      path: encodeDialResourcePath(parsed.path),
    };
    assertOwnBucket(resource, userBucket);
    return Promise.resolve(resource);
  };

/**
 * Copies a catalog entity of the caller's own bucket into a folder of the
 * public bucket (an org-unit folder), without a publication request. Every
 * right and per-type rule is DIAL Core's: its 403 and 409 reach the caller as
 * they are. The per-type differences live in {@link OrgUnitCopyService.copyTypes}
 * only; a type without an entry answers 400.
 */
@Injectable()
export class OrgUnitCopyService {
  private readonly logger = new Logger(OrgUnitCopyService.name);

  private readonly copyTypes: Partial<
    Record<CatalogEntityType, OrgUnitCopyType>
  >;

  constructor(
    private readonly dialClient: DialClientService,
    private readonly applicationsService: ApplicationsService,
    private readonly toolsetsListingService: ToolsetsListingService,
  ) {
    this.copyTypes = {
      [CatalogEntityType.Application]: {
        resourceType: DialResourceType.Applications,
        resolveOwn: (authHeaders, entityId, userBucket) =>
          this.applicationsService.resolveOwnApplication(
            authHeaders,
            entityId,
            userBucket,
          ),
        invalidate: (userSub, entityId, copyId, context) =>
          this.applicationsService.invalidateAfterWrite(
            userSub,
            [entityId, copyId],
            context,
          ),
      },
      [CatalogEntityType.Toolset]: {
        resourceType: DialResourceType.Toolsets,
        resolveOwn: async (authHeaders, entityId, userBucket) => {
          const resource =
            await this.toolsetsListingService.resolveToolsetResource(
              authHeaders,
              entityId,
            );
          assertOwnBucket(resource, userBucket);
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
      },
      [CatalogEntityType.Prompt]: {
        resourceType: DialResourceType.Prompts,
        resolveOwn: resolveOwnFullId(parsePromptId, 'prompt'),
        invalidate: NOTHING_TO_INVALIDATE,
      },
      [CatalogEntityType.Skill]: {
        resourceType: DialResourceType.Skills,
        resolveOwn: resolveOwnFullId(parseSkillResourceUrl, 'skill'),
        invalidate: NOTHING_TO_INVALIDATE,
      },
    };
  }

  /**
   * @param userSub - session user whose caches are cleared
   * @param userBucket - the session user's own bucket, which a source must lie in
   * @param accessToken - bearer token for DIAL Core
   * @param entityType - catalog entity kind of `entityId`
   * @param entityId - own resource: a bare name or full id for applications and toolsets, the full `{type}/{bucket}/{path}` id for prompts and skills (a bare name answers 400)
   * @param body - destination folder
   * @returns the full id of the copy in the public bucket
   * @throws {BadRequestException} When the entity type has no org-unit copy, or `entityId` is not a full id where one is required
   * @throws {ForbiddenException} When the entity is not in the caller's own bucket or Core refuses the write
   * @throws {ConflictException} When the target already exists, or Core refuses the copy as a conflict
   */
  async copyIntoOrgUnit(
    userSub: string,
    userBucket: string,
    accessToken: string,
    entityType: CatalogEntityType,
    entityId: string,
    body: CopyCatalogEntityToOrgUnitDto,
  ): Promise<ResourceIdResponseDto> {
    const copyType = this.copyTypes[entityType];
    if (copyType == null) {
      throw new BadRequestException(
        `Copying a ${entityType} into an org unit is not supported`,
      );
    }
    const authHeaders = getBearerAuthHeaders(accessToken);
    const context = `copy ${entityType} "${entityId}" into an org unit`;
    let id: string;
    try {
      const source = await copyType.resolveOwn(
        authHeaders,
        entityId,
        userBucket,
      );
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
      });
      id = `${copyType.resourceType}/${destination.bucket}/${destination.path}`;
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, 0);
    }

    await copyType.invalidate(userSub, entityId, id, context);
    return { id };
  }
}
