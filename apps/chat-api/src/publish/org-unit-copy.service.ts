import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import { handleDialFetchError } from '../common/dial/dial-error.mapper';
import type { ResourceIdResponseDto } from '../common/dto/resource-folder.dto';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import {
  DialResourceType,
  assertOwnBucket,
  buildFolderResourcePath,
  existsQuietly,
  getResourceLeaf,
  parseDialResourceUrl,
  resourceExists,
  toDialResourceUrl,
  transferDialResource,
  type DialResourceLocation,
} from '../common/utils/dial-resource-transfer';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import { OrgUnitsService } from '../org-units/org-units.service';
import { parsePromptId } from '../prompts/utils/prompt-mapper.util';
import { parseSkillResourceUrl } from '../skills/utils/skill-path.util';
import { ToolsetsListingService } from '../toolsets/listing/toolsets-listing.service';
import {
  CATALOG_TYPE_BY_DEPENDENCY,
  DIAL_TYPE_BY_DEPENDENCY,
  ApplicationPublishPreparationService,
  type ApplicationDependencyPlan,
} from './application-publish-preparation.service';
import { CatalogEntityType } from './dto/catalog-entity-params.dto';
import type { CopyCatalogEntityToOrgUnitDto } from './dto/copy-catalog-entity-to-org-unit.dto';
import {
  getPublishedIconTargetUrl,
  readPublishableApplicationIconUrl,
} from './publish-target.util';

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

/** A dependency this call copied, with where it went. */
interface CopiedDependency {
  dependency: ApplicationDependencyPlan['dependencies'][number];
  targetUrl: string;
}

/** What {@link OrgUnitCopyService} needs to copy one application with its dependencies. */
interface CopyApplicationParams {
  userSub: string;
  userBucket: string;
  accessToken: string;
  folderPath: string;
  source: DialResourceLocation;
  destination: DialResourceLocation;
  context: string;
}

/**
 * The org-unit namespace of a dependency kind, which is its resource type's group.
 * @param type - the dependency kind
 * @throws {Error} When the kind has no resource type to copy, which a planned dependency never has
 */
const getNamespace = (
  type: ApplicationDependencyPlan['dependencies'][number]['type'],
): DialResourceType => {
  const resourceType = DIAL_TYPE_BY_DEPENDENCY[type];
  if (resourceType == null) {
    throw new Error(`A ${type} dependency has no resource type to copy`);
  }
  return resourceType;
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
    private readonly preparation: ApplicationPublishPreparationService,
    private readonly orgUnitsService: OrgUnitsService,
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
    let copiedDependencies: CopiedDependency[] = [];
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
      if (entityType === CatalogEntityType.Application) {
        copiedDependencies = await this.copyApplication({
          userSub,
          userBucket,
          accessToken,
          folderPath: body.folderPath,
          source,
          destination,
          context,
        });
      } else {
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
      }
      id = `${copyType.resourceType}/${destination.bucket}/${destination.path}`;
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, 0);
    }

    await copyType.invalidate(userSub, entityId, id, context);
    await this.invalidateDependencies(userSub, copiedDependencies, context);
    return { id };
  }

  /**
   * Copies an application together with its first-level private dependencies
   * and icon: rights check, icon, staging copy, each missing dependency, the
   * staging copy to the target, and the staging copy's deletion. An
   * application with neither dependencies nor an own icon takes the single copy
   * of any other type. Nothing already copied is rolled back on a failure.
   * @param params - the caller, the own source and the destination of the application
   * @returns the dependencies this call copied, for cache clearing
   * @throws {ForbiddenException} When the caller may not write a namespace the write needs
   */
  private async copyApplication(
    params: CopyApplicationParams,
  ): Promise<CopiedDependency[]> {
    const { userSub, userBucket, accessToken, folderPath } = params;
    const { source, destination, context } = params;
    /* The caller may name the application by its bare name; the dependency resolver needs the full id. */
    const entityId = toDialResourceUrl(DialResourceType.Applications, source);
    const headers = getBearerAuthHeaders(accessToken);
    const leaf = getResourceLeaf(source.path);
    const plan = (await this.preparation.plan(
      userSub,
      accessToken,
      userBucket,
      entityId,
      folderPath,
      leaf,
      true,
    )) ?? { dependencies: [], toCopy: [], targets: new Map() };
    const iconUrl = await readPublishableApplicationIconUrl(
      this.dialClient.client,
      accessToken,
      entityId,
      this.logger,
      'copying',
    );
    const transfer = (
      type: DialResourceType,
      from: DialResourceLocation,
      to: DialResourceLocation,
    ) =>
      transferDialResource({
        client: this.dialClient.client,
        operation: 'copyResource',
        type,
        headers,
        source: from,
        destination: to,
        context,
        logger: this.logger,
      });

    if (plan.dependencies.length === 0 && iconUrl == null) {
      await transfer(DialResourceType.Applications, source, destination);
      return [];
    }

    if (
      await resourceExists(
        this.dialClient.client,
        DialResourceType.Applications,
        destination,
        headers,
      )
    ) {
      throw new ConflictException('Target resource already exists');
    }

    const missing = await this.orgUnitsService.findMissingWriteNamespaces(
      userSub,
      accessToken,
      folderPath,
      [
        DialResourceType.Applications,
        ...plan.toCopy.map(({ dependency }) => getNamespace(dependency.type)),
        ...(iconUrl == null ? [] : [DialResourceType.Files]),
      ],
    );
    const missingRequired = (missing ?? []).filter(
      (namespace) => namespace !== DialResourceType.Files,
    );
    if (missingRequired.length > 0) {
      throw new ForbiddenException(
        `Write access in this org unit is missing for: ${missingRequired.join(', ')}`,
      );
    }
    const mayWriteFiles = !(missing ?? []).includes(DialResourceType.Files);

    const stagedIcon =
      iconUrl == null
        ? undefined
        : await this.copyIcon(
            iconUrl,
            mayWriteFiles,
            folderPath,
            leaf,
            headers,
            transfer,
          );
    const copy = await this.preparation.stage(
      userSub,
      accessToken,
      userBucket,
      entityId,
      plan,
      stagedIcon,
    );
    const copied: CopiedDependency[] = [];
    try {
      for (const planned of plan.toCopy) {
        const type = DIAL_TYPE_BY_DEPENDENCY[planned.dependency.type];
        if (type == null) continue;
        try {
          await transfer(
            type,
            parseDialResourceUrl(planned.sourceUrl),
            parseDialResourceUrl(planned.targetUrl),
          );
          copied.push({
            dependency: planned.dependency,
            targetUrl: planned.targetUrl,
          });
        } catch (err) {
          /* The target appeared since the plan was made: reuse it, as the plan does for an existing one. A conflict with nothing at the target is not that. */
          if (!(err instanceof ConflictException)) throw err;
          const { bucket, path } = parseDialResourceUrl(planned.targetUrl);
          const isPresent = await resourceExists(
            this.dialClient.client,
            type,
            { bucket, path },
            headers,
          );
          if (!isPresent) throw err;
        }
      }
      await transfer(DialResourceType.Applications, copy.resource, destination);
    } catch (err) {
      await this.invalidateDependencies(userSub, copied, context);
      throw err;
    } finally {
      await this.preparation.deleteCopy(userSub, accessToken, copy);
    }
    return copied;
  }

  /**
   * Copies the application's uploaded icon next to the application's other
   * files. Never blocks the write: without `write` on `files`, or when the copy
   * fails, the icon is dropped from the staging copy.
   * @param iconUrl - the icon's `files/{bucket}/{path}` url
   * @param mayWriteFiles - whether the caller may write `files` in the unit; `false` skips the copy
   * @param folderPath - plain target folder
   * @param leaf - the application's target name
   * @param headers - the caller's auth headers
   * @param transfer - the copy call
   * @returns the url the staging copy's `iconUrl` takes, or `null` when the icon is dropped
   */
  private async copyIcon(
    iconUrl: string,
    mayWriteFiles: boolean,
    folderPath: string,
    leaf: string,
    headers: ReturnType<typeof getBearerAuthHeaders>,
    transfer: (
      type: DialResourceType,
      from: DialResourceLocation,
      to: DialResourceLocation,
    ) => Promise<void>,
  ): Promise<string | null> {
    if (!mayWriteFiles) return null;
    const targetUrl = getPublishedIconTargetUrl(folderPath, leaf, iconUrl);
    try {
      await transfer(
        DialResourceType.Files,
        parseDialResourceUrl(iconUrl),
        parseDialResourceUrl(targetUrl),
      );
    } catch (err) {
      /* An icon already copied by an earlier attempt is reused, when it is really there. */
      if (
        err instanceof ConflictException &&
        (await existsQuietly(
          this.dialClient.client,
          DialResourceType.Files,
          parseDialResourceUrl(targetUrl),
          headers,
        ))
      ) {
        return targetUrl;
      }
      this.logger.warn(
        `Copying the icon "${iconUrl}" failed, the application is written without it: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return null;
    }
    return targetUrl;
  }

  /**
   * Clears the caches of the copied dependencies that are applications or
   * toolsets. A failure is logged and never fails the response.
   * @param userSub - session user whose caches are cleared
   * @param copied - the dependencies this call copied
   * @param context - what the call was doing, for the log
   */
  private async invalidateDependencies(
    userSub: string,
    copied: CopiedDependency[],
    context: string,
  ): Promise<void> {
    for (const { dependency, targetUrl } of copied) {
      const type = CATALOG_TYPE_BY_DEPENDENCY[dependency.type];
      const copyType = type == null ? undefined : this.copyTypes[type];
      if (copyType == null) continue;
      try {
        await copyType.invalidate(userSub, dependency.id, targetUrl, context);
      } catch (err) {
        this.logger.warn(
          `Clearing caches after copying "${targetUrl}" failed: ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
        );
      }
    }
  }
}
