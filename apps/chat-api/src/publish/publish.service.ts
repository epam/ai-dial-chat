import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { AdminRoleService } from '../auth/admin-role.service';
import type { SessionUser } from '../auth/session/session.types';
import {
  extractDialErrorMessage,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import {
  dialResourceExists,
  existsQuietly,
} from '../common/utils/dial-resource-transfer';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { RESOURCE_VERSION_SEPARATOR } from '../common/utils/next-free-path';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { readPublicationDisplayAuthor } from '../common/utils/user-display-name';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import { FilesListingService } from '../files/listing/files-listing.service';
import { ApplicationBeingPublishedException } from './application-publish-copy.service';
import {
  CATALOG_TYPE_BY_DEPENDENCY,
  ApplicationPublishPreparationService,
  type PreparedApplicationPublication,
} from './application-publish-preparation.service';
import { CatalogEntityType } from './dto/catalog-entity-params.dto';
import { createTargetExistsConflict } from './dto/publish-conflict.dto';
import { PublishHistoryEntryDto } from './dto/publish-history-entry.dto';
import { PublishResultDto } from './dto/publish-result.dto';
import { PublishTargetCheckDto } from './dto/publish-target-check.dto';
import type { UnpublishAccessDto } from './dto/unpublish-access.dto';
import { UnpublishResultDto } from './dto/unpublish-result.dto';
import {
  getPublicationSourceCredentials,
  getPublicationSourceTargetUrl,
  publishesCopy,
  isStatusDetailCandidate,
  resolvePublicationDetails,
  resolvePublicationsForSource,
  toPublicationList,
} from './publication.util';
import {
  PUBLIC_URL_PREFIX,
  getPublicationsListScope,
  getPublicTargetFolder,
  readPublishableApplicationIconUrl,
  getPublishedApplicationFilesFolderUrl,
  getPublishedIconTargetUrl,
  getPublishedTargetUrl,
  getResourceBucket,
  getResourceName,
  getPublishTargetLocation,
  getResourceTypePrefix,
  getVersionedTargetResourceName,
  resolvePublishTarget,
  stripPublicTargetFolder,
} from './publish-target.util';
import { buildPublishedFolderDeleteResources } from './published-folder-delete-resources';
import type { StatusPublication } from './version-status.util';

/*
 * This service does NOT inject SkillsLookupService. Skill publication uses the
 * whole resource URL and intentionally has no synthetic version; a missing
 * request version degrades to the empty value already used by skill history.
 */
const historyCacheKey = (entityType: CatalogEntityType, entityId: string) =>
  `publish-history:${entityType}:${entityId}`;

/* The caller's resolved own-bucket publications behind the version statuses; cleared by every publish and unpublish. */
const bucketPublicationsCacheKey = (bucket: string) =>
  `publish:bucket-publications:${bucket}`;

const BUCKET_PUBLICATIONS_TTL_MS = 60 * 1000;

/* Core's rejection of a publication whose target exists reads "Target resource already exists: {targetUrl}". */
const TARGET_EXISTS_PATTERN = /target resource already exists/i;

/* Keyed by the caller's bucket, so one caller's answer is never served to another. */
const unpublishAccessCacheKey = (
  bucket: string,
  entityType: CatalogEntityType,
  entityId: string,
) => `unpublish-access:${bucket}:${entityType}:${entityId}`;

const UNPUBLISH_ACCESS_TTL_MS = 60 * 1000;

/**
 * Catalog entity names are always `{name}__{version}` (see
 * `applications.service.ts`/`toolsets.service.ts`), so the entity's display
 * name and version are recovered from `entityId`'s own last path segment
 * rather than from `Publication.name` — the latter is a free-text request
 * title, not a version field (see the module doc comment below).
 */
const splitEntityNameAndVersion = (
  entityId: string,
): { name: string; version: string } => {
  const resourceName = getResourceName(entityId);
  const separatorIndex = resourceName.lastIndexOf(RESOURCE_VERSION_SEPARATOR);
  if (separatorIndex === -1) {
    return { name: safeDecodeURIComponent(resourceName), version: '' };
  }
  return {
    name: safeDecodeURIComponent(resourceName.slice(0, separatorIndex)),
    version: resourceName.slice(
      separatorIndex + RESOURCE_VERSION_SEPARATOR.length,
    ),
  };
};

/** The version suffix of a published copy's `targetUrl`, or `fallback` when there is no target or it carries none. */
const getPublishedVersion = (
  targetUrl: string | undefined,
  fallback: string | undefined,
): string => {
  const version = targetUrl ? splitEntityNameAndVersion(targetUrl).version : '';
  return version ? safeDecodeURIComponent(version) : (fallback ?? '');
};

/**
 * Publishes catalog entities (Toolset, Application, Prompt, Skill) to an Organization
 * folder and reads their publish history by proxying DIAL Core's
 * Publication API (`createPublication`/`getPublications`) — this service
 * holds no persistence of its own. `apps/chat-api` has no database, and Core
 * is the sole source of truth (see `openspec/changes/archive/2026-07-14-add-catalog-publish-to-folder/design.md` D3 for why chat-api-side
 * `PublishHistoryEntry` storage was rejected).
 *
 * Core's `Publication`/`PublicationResource` schema has no version field.
 * `Publication.name` is a free-text request title, not a place to encode
 * the version on its own — an earlier version of this service set it to
 * the bare version string, which is why publish requests were showing up
 * without a readable title in DIAL Core's admin UI. It is now built as
 * `"{entity name} {version}"` (no author — `displayAuthor` already carries
 * that separately) from `entityId`'s own `{name}__{version}` suffix (see
 * `splitEntityNameAndVersion`), which is also where the version is
 * recovered from when reading history back.
 */
@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly adminRoleService: AdminRoleService,
    private readonly applicationPublishPreparation: ApplicationPublishPreparationService,
    private readonly filesListingService: FilesListingService,
  ) {}

  /**
   * @param publishCredentials When true, asks DIAL Core to copy the publisher's
   * own credential for the entity onto the published copy so members of the
   * organization use it without authorising individually. Carries the
   * publisher's intent only — it changes no authorization here or in Core.
   *
   * @param userSub Caller's session subject; scopes cached schemas and lists when an application is published with its dependencies. Defaults to the bucket.
   *
   * An application with private dependencies is published together with them in
   * the one request, through a temporary rewritten copy (see
   * `ApplicationPublishCopyService`); any other entity, and an application
   * without such dependencies, sends the request it always did.
   *
   * @throws {NotFoundException} When Core reports the entity or folder as unknown
   * @throws {ForbiddenException} When the caller lacks write access to `folderPath`
   * @throws {ApplicationBeingPublishedException} When the same application is already being published
   * @throws {BadGatewayException} When Core returns an unexpected error, a 5xx, or is unreachable
   */
  async publish(
    accessToken: string,
    bucket: string,
    entityType: CatalogEntityType,
    entityId: string,
    folderPath: string,
    version: string | undefined,
    author: string,
    publishCredentials?: boolean,
    userSub: string = bucket,
  ): Promise<PublishResultDto> {
    /*
     * `entityId` arrives as plain, unencoded text (e.g. a prompt path can
     * end in a literal space, `prompts/{bucket}/test space`) — DIAL Core
     * rejects resource urls containing raw spaces/special characters, so
     * `sourceUrl` must be percent-encoded per segment before it is sent to
     * Core, exactly as `conversation-publish.service.ts` already does for
     * conversations.
     */
    const publicTargetFolder = getPublicTargetFolder(folderPath);
    const { sourceUrl, targetResourceName, targetUrl } = resolvePublishTarget(
      entityId,
      folderPath,
      version,
    );
    const iconUrl = await readPublishableApplicationIconUrl(
      this.dialClient.client,
      accessToken,
      sourceUrl,
      this.logger,
      'publishing',
    );
    const { name: entityName, version: resourceVersion } =
      splitEntityNameAndVersion(sourceUrl);
    const publicationVersion = version || resourceVersion;
    const prepared = await this.prepareApplicationPublication(
      entityType,
      userSub,
      accessToken,
      bucket,
      entityId,
      folderPath,
      targetResourceName,
    );
    let result;
    try {
      const requestBody = {
        /* A prompt carries no version, so the title must not gain a trailing space. */
        name: `${entityName} ${publicationVersion}`.trim(),
        targetFolder: publicTargetFolder,
        /*
         * `publishCredentials` is omitted entirely when false rather than sent as
         * `false`, so the Core request stays byte-identical to the pre-change
         * request for every caller that does not set it.
         */
        resources: [
          {
            action: 'ADD' as const,
            /* The icon, names and version above come from the original; only this source is the rewritten copy. */
            sourceUrl: prepared ? prepared.copy.id : sourceUrl,
            targetUrl,
            ...(publishCredentials ? { publishCredentials: true } : {}),
          },
          ...(iconUrl != null
            ? [
                {
                  action: 'ADD' as const,
                  sourceUrl: iconUrl,
                  targetUrl: getPublishedIconTargetUrl(
                    folderPath,
                    targetResourceName,
                    iconUrl,
                  ),
                },
              ]
            : []),
          /* No `publishCredentials`: the flag is a per-resource choice made for the application only (design D9). */
          ...(prepared?.dependencyResources ?? []),
        ],
        /* No `rules`: an absent key leaves the target folder's stored DIAL Core rules untouched, while `[]` could replace them. */
        displayAuthor: author,
      };
      try {
        result = await this.dialClient.client.createPublication({
          headers: getBearerAuthHeaders(accessToken),
          body: requestBody,
        });
      } catch (err) {
        this.logger.error(
          `Unexpected error publishing ${entityType} "${entityId}"`,
          err instanceof Error ? err.stack : undefined,
        );
        throw new BadGatewayException('Failed to publish to DIAL Core');
      }
    } finally {
      if (prepared) {
        await this.applicationPublishPreparation.cleanup(
          userSub,
          accessToken,
          prepared,
        );
      }
    }

    /*
     * `openapi-fetch` short-circuits on an empty response body (e.g. a
     * `Content-Length: 0` error response) and returns `{ error: undefined }`
     * without reading the body, even for a non-2xx status — so `result.error`
     * alone cannot be trusted to detect failure (see the same guard in
     * `models.service.ts` and `files-listing.service.ts`).
     */
    if (!result.response.ok || result.error != null) {
      const upstreamMessage = extractDialErrorMessage(result.error);
      if (
        await this.isTargetTakenRejection(
          accessToken,
          result.response.status,
          targetUrl,
          upstreamMessage,
        )
      ) {
        this.logger.warn(
          `Publish of ${entityType} "${entityId}" rejected: target already exists`,
        );
        throw createTargetExistsConflict();
      }
      return mapDialHttpStatus(
        result.response.status,
        `publish ${entityType} "${entityId}"`,
        this.logger,
        result.error,
        upstreamMessage,
      );
    }

    await this.cacheManager.del(historyCacheKey(entityType, entityId));
    for (const dependency of prepared?.publishedDependencies ?? []) {
      const dependencyType = CATALOG_TYPE_BY_DEPENDENCY[dependency.type];
      if (dependencyType == null) continue;
      await this.cacheManager.del(
        historyCacheKey(dependencyType, safeDecodeURIComponent(dependency.id)),
      );
    }
    await this.cacheManager.del(bucketPublicationsCacheKey(bucket));

    /*
     * Core returns 200 with no parseable body for some auto-approved
     * publications (observed for a resource published for the first time),
     * leaving `result.data` undefined even though the request succeeded —
     * fall back to what the caller already supplied rather than reading off
     * a body that may not exist.
     */
    const publication = result.data;
    this.logger.debug(
      `Published ${entityType} "${entityId}" to "${folderPath}"`,
    );
    if (prepared) {
      this.logger.debug(
        `Published ${prepared.publishedDependencies.length} dependencies with ${entityType} "${entityId}", reused ${prepared.reusedCount}`,
      );
    }

    return {
      entityId,
      entityType,
      folderPath,
      version: publicationVersion,
      publishedAt: publication?.createdAt
        ? new Date(publication.createdAt).toISOString()
        : new Date().toISOString(),
      publishedBy: readPublicationDisplayAuthor(publication, author),
    };
  }

  /**
   * Prepares an application's publication together with its dependencies. Any
   * failure but "already being published" is logged and answered with
   * `undefined`, so the application is published the way it was before
   * dependencies were published with it.
   * @param entityType - catalog entity kind being published
   * @param userSub - caller's session subject
   * @param accessToken - caller's bearer token
   * @param bucket - caller's own bucket
   * @param entityId - the entity's resource path
   * @param folderPath - plain publish target folder
   * @param targetResourceName - last segment of the entity's published `targetUrl`
   * @throws {ApplicationBeingPublishedException} When the same application is already being published
   */
  private async prepareApplicationPublication(
    entityType: CatalogEntityType,
    userSub: string,
    accessToken: string,
    bucket: string,
    entityId: string,
    folderPath: string,
    targetResourceName: string,
  ): Promise<PreparedApplicationPublication | undefined> {
    if (entityType !== CatalogEntityType.Application) return undefined;
    try {
      return await this.applicationPublishPreparation.prepare(
        userSub,
        accessToken,
        bucket,
        entityId,
        folderPath,
        targetResourceName,
      );
    } catch (err) {
      if (err instanceof ApplicationBeingPublishedException) throw err;
      this.logger.warn(
        `Publishing ${entityType} "${entityId}" without its dependencies: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return undefined;
    }
  }

  /**
   * Reports whether the published copy of an entity would land on a path that
   * is already taken, reading the target's metadata with the caller's own
   * token. A copy the caller cannot read, or one still pending approval, is not
   * found; the publish itself answers `409` for those.
   * @param accessToken - bearer token for DIAL Core
   * @param entityType - catalog entity kind
   * @param entityId - plain resource path of the entity
   * @param folderPath - plain destination folder
   * @param version - optional display version, which names the copy of an application or toolset
   * @throws {BadRequestException} When the entity type has no readable published copy
   * @throws {ForbiddenException} When Core refuses the caller the read
   * @throws {BadGatewayException} When Core returns an unexpected error or is unreachable
   */
  async checkPublishTarget(
    accessToken: string,
    entityType: CatalogEntityType,
    entityId: string,
    folderPath: string,
    version: string | undefined,
  ): Promise<PublishTargetCheckDto> {
    const { targetUrl } = resolvePublishTarget(entityId, folderPath, version);
    const target = getPublishTargetLocation(targetUrl);
    if (target == null) {
      throw new BadRequestException(
        `A published ${entityType} has no target to check`,
      );
    }
    const taken = await dialResourceExists(
      this.dialClient.client,
      target.type,
      target.location,
      getBearerAuthHeaders(accessToken),
      `check publish target of ${entityType} "${entityId}"`,
      this.logger,
    );
    return { taken };
  }

  /**
   * Whether a failed `createPublication` was Core refusing a target that
   * already exists. Core answers 400 (sometimes 409) for it, so the status
   * alone is not enough: the target is confirmed by reading its metadata with
   * the caller's token, or by Core's own message, which also covers a copy the
   * caller cannot read.
   */
  private async isTargetTakenRejection(
    accessToken: string,
    status: number,
    targetUrl: string,
    upstreamMessage: string | undefined,
  ): Promise<boolean> {
    if (status !== 400 && status !== 409) return false;
    if (
      upstreamMessage != null &&
      TARGET_EXISTS_PATTERN.test(upstreamMessage)
    ) {
      return true;
    }
    const target = getPublishTargetLocation(targetUrl);
    if (target == null) return false;
    return existsQuietly(
      this.dialClient.client,
      target.type,
      target.location,
      getBearerAuthHeaders(accessToken),
    );
  }

  /**
   * Submits a removal request for one already-published folder of a catalog
   * entity. DIAL Core models removal as a *publication* whose single resource
   * carries `action: 'DELETE'` — the same `createPublication` call, the same
   * `PENDING → APPROVED/REJECTED` lifecycle, the same admin in the loop. Core's
   * separate `deletePublication` discards a still-pending publication *request*,
   * which is a different feature.
   *
   * So this returns a submitted request, never a completed removal: the
   * published copy stays visible to everyone who could already see it until an
   * administrator approves. Nothing in the result may assert otherwise.
   *
   * Only an administrator or the copy's publisher may ask (see
   * `canUnpublish`); anyone else is refused before Core is called.
   *
   * @throws {NotFoundException} When Core reports the entity or target as unknown
   * @throws {ForbiddenException} When the caller is neither an administrator nor the publisher, or lacks write access to `folderPath`
   * @throws {BadGatewayException} When Core returns an unexpected error, a 5xx, or is unreachable
   */
  async unpublish(
    user: SessionUser,
    entityType: CatalogEntityType,
    entityId: string,
    folderPath: string,
    version: string | undefined,
    author: string,
  ): Promise<UnpublishResultDto> {
    const { at: accessToken, bucket } = user;
    if (!(await this.canUnpublish(user, entityType, entityId))) {
      this.logger.warn(
        `Refused unpublish of ${entityType} "${entityId}": caller is neither an administrator nor its publisher`,
      );
      throw new ForbiddenException(
        'You can only unpublish resources you published',
      );
    }

    /* See the matching `sourceUrl` encoding comment in `publish` above. */
    const sourceUrl = encodeDialResourcePath(entityId);
    const publicTargetFolder = getPublicTargetFolder(folderPath);
    const resourceTypePrefix = getResourceTypePrefix(sourceUrl);
    /*
     * The copy in this folder may carry a different version than the entity
     * does now (a new version is published under a new name, see
     * `getVersionedTargetResourceName`), so the target is read off the
     * folder's own publication. Deriving it is the fallback for a folder
     * whose publication cannot be read.
     */
    const publishedTargetUrl = await this.findPublishedTargetUrl(
      accessToken,
      bucket,
      entityId,
      folderPath,
      version,
    );
    const targetUrl =
      publishedTargetUrl ??
      getPublishedTargetUrl(
        resourceTypePrefix,
        folderPath,
        getVersionedTargetResourceName(
          resourceTypePrefix,
          getResourceName(sourceUrl),
          version,
        ),
      );
    const { name: entityName, version: resourceVersion } =
      splitEntityNameAndVersion(sourceUrl);
    const publicationVersion = version || resourceVersion;
    /*
     * The Publish panel unpublishes through the published copy's own url, which
     * no publication names as a source, so `publishedTargetUrl` is unset there.
     * The copy's own folder is then the one to clear, and `canUnpublish` has
     * already limited the caller to an administrator or that copy's publisher.
     * From the author's own url the folder is listed only when the caller's
     * publication confirms it: another author's application in the same folder
     * can share the name.
     */
    const publishedFileResources =
      entityType === CatalogEntityType.Application &&
      (publishedTargetUrl != null ||
        getResourceBucket(sourceUrl) === PUBLIC_URL_PREFIX)
        ? await this.buildPublishedFileDeleteResources(
            accessToken,
            folderPath,
            entityId,
            targetUrl,
          )
        : [];
    /*
     * `sourceUrl` is sent even though Core allows it to be omitted for a
     * `DELETE` action: it costs nothing and keeps the DELETE resource shape
     * identical to the ADD one publish sends. `rules` is omitted entirely —
     * access rules govern who may see a published resource, and a removal
     * request grants nobody anything.
     */
    const requestBody = {
      name: `${entityName} ${publicationVersion}`.trim(),
      targetFolder: publicTargetFolder,
      resources: [
        { action: 'DELETE' as const, sourceUrl, targetUrl },
        ...publishedFileResources,
      ],
      displayAuthor: author,
    };
    let result;
    try {
      result = await this.dialClient.client.createPublication({
        headers: getBearerAuthHeaders(accessToken),
        body: requestBody,
      });
    } catch (err) {
      this.logger.error(
        `Unexpected error requesting unpublish of ${entityType} "${entityId}"`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new BadGatewayException(
        'Failed to submit unpublish request to DIAL Core',
      );
    }

    /* See the matching `openapi-fetch` empty-body guard comment in `publish` above. */
    if (!result.response.ok || result.error != null) {
      return mapDialHttpStatus(
        result.response.status,
        `unpublish ${entityType} "${entityId}"`,
        this.logger,
        result.error,
        extractDialErrorMessage(result.error),
      );
    }

    await this.cacheManager.del(historyCacheKey(entityType, entityId));
    await this.cacheManager.del(bucketPublicationsCacheKey(bucket));

    /* See the matching comment in `publish` above: `result.data` can be undefined. */
    const publication = result.data;
    this.logger.debug(
      `Requested unpublish of ${entityType} "${entityId}" from "${folderPath}"`,
    );

    return {
      entityId,
      entityType,
      folderPath,
      version: publicationVersion,
      requestedAt: publication?.createdAt
        ? new Date(publication.createdAt).toISOString()
        : new Date().toISOString(),
      requestedBy: readPublicationDisplayAuthor(publication, author),
    };
  }

  /**
   * The `DELETE` resources for the files published next to an application, its
   * icon among them, read from what exists in its published folder
   * `files/public/{folder}/{published name}/`. Without them a republish of the
   * same version meets the leftover file and Core refuses it.
   *
   * Best-effort: a listing that fails is logged and the application is removed
   * without its files, as it was before they were removed with it.
   * @param accessToken - caller's bearer token
   * @param folderPath - plain folder the application is unpublished from
   * @param entityId - the application's resource path, for the log line
   * @param targetUrl - the published application's `targetUrl`
   */
  private async buildPublishedFileDeleteResources(
    accessToken: string,
    folderPath: string,
    entityId: string,
    targetUrl: string,
  ) {
    try {
      return await buildPublishedFolderDeleteResources(
        this.filesListingService,
        accessToken,
        getPublishedApplicationFilesFolderUrl(
          folderPath,
          getResourceName(targetUrl),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Could not list the published files of application "${entityId}" in "${folderPath}"; unpublishing it without them`,
        err instanceof Error ? err.stack : undefined,
      );
      return [];
    }
  }

  /**
   * Whether the caller may request removal of `entityId`: an administrator
   * (`AdminRoleService`), the owner of a resource in their own bucket, or the
   * publisher of a public copy — the bucket holding the live `ADD` publication
   * that created it (`publishesCopy`). Names (`displayAuthor`, `author`) never
   * count: they are free text.
   *
   * Only the publisher lookup is cached, per caller and entity, for 60 s;
   * ownership changes when an administrator approves a publication in Core,
   * which this service is not told about, so the TTL bounds staleness.
   *
   * Fails closed: an unreadable publication list throws instead of answering.
   *
   * @throws {BadGatewayException} When Core returns an error for the publication list or is unreachable
   */
  async canUnpublish(
    user: SessionUser,
    entityType: CatalogEntityType,
    entityId: string,
  ): Promise<boolean> {
    if (this.adminRoleService.isAdmin(user)) {
      return true;
    }
    /* An unresolved (empty) bucket owns nothing, so a bare id cannot match it. */
    if (user.bucket && getResourceBucket(entityId) === user.bucket) {
      return true;
    }

    const cacheKey = unpublishAccessCacheKey(user.bucket, entityType, entityId);
    /* An object, not a bare boolean, so a cached `false` still reads as a hit. */
    const cached = await this.cacheManager.get<UnpublishAccessDto>(cacheKey);
    if (cached) {
      return cached.canUnpublish;
    }

    const context = `unpublish access to ${entityType} "${entityId}"`;
    let publications: Awaited<ReturnType<typeof this.listResolvedPublications>>;
    try {
      publications = await this.listResolvedPublications(
        user.at,
        user.bucket,
        context,
      );
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(
        `Unexpected error checking ${context}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new BadGatewayException(
        'Failed to read publications from DIAL Core',
      );
    }

    const access: UnpublishAccessDto = {
      canUnpublish: publishesCopy(publications, entityId),
    };
    await this.cacheManager.set(cacheKey, access, UNPUBLISH_ACCESS_TTL_MS);
    return access.canUnpublish;
  }

  /**
   * @throws {BadGatewayException} When Core returns an unexpected error
   * @throws {ServiceUnavailableException} When Core is unreachable or times out
   */
  async getPublishHistory(
    accessToken: string,
    bucket: string,
    entityType: CatalogEntityType,
    entityId: string,
  ): Promise<PublishHistoryEntryDto[]> {
    const sourceUrl = entityId;
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: historyCacheKey(entityType, entityId),
      ttlMs: 60 * 1000,
      context: `get publish history for ${entityType} "${entityId}"`,
      logger: this.logger,
      fetch: async () => {
        const { version: sourceVersion } = splitEntityNameAndVersion(sourceUrl);
        const publications = await this.listSourcePublications(
          accessToken,
          bucket,
          sourceUrl,
          `publish history for ${entityType} "${entityId}"`,
        );

        return publications
          .map((publication): PublishHistoryEntryDto => ({
            entityId,
            entityType,
            folderPath: stripPublicTargetFolder(publication.targetFolder ?? ''),
            /*
             * The version this publication put in the folder, read off its
             * target — the source's own suffix only records the version the
             * entity was created with (see `getVersionedTargetResourceName`).
             */
            version: getPublishedVersion(
              getPublicationSourceTargetUrl(publication, sourceUrl),
              sourceVersion,
            ),
            publishedAt: publication.createdAt
              ? new Date(publication.createdAt).toISOString()
              : '',
            publishedBy: readPublicationDisplayAuthor(publication, ''),
            publishCredentials: getPublicationSourceCredentials(
              publication,
              sourceUrl,
            ),
          }))
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      },
    });
  }

  /**
   * Every publication in the caller's own bucket that Core did not reject, with
   * its `resources` resolved — `PENDING` ones included, unlike
   * `getPublishHistory`. Read once and cached per bucket for 60 s; publish and
   * unpublish clear it.
   *
   * @throws {BadGatewayException} When Core returns an unexpected error
   * @throws {ServiceUnavailableException} When Core is unreachable or times out
   */
  async getBucketPublications(
    accessToken: string,
    bucket: string,
  ): Promise<StatusPublication[]> {
    const context = 'version statuses publications';
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: bucketPublicationsCacheKey(bucket),
      ttlMs: BUCKET_PUBLICATIONS_TTL_MS,
      context,
      logger: this.logger,
      fetch: () =>
        this.listResolvedPublications(
          accessToken,
          bucket,
          context,
          isStatusDetailCandidate,
        ),
    });
  }

  /**
   * Every live publication of `sourceUrl` in the caller's bucket, with its
   * `resources` resolved.
   *
   * @throws {BadGatewayException} When Core returns an unexpected error
   */
  private async listSourcePublications(
    accessToken: string,
    bucket: string,
    sourceUrl: string,
    context: string,
  ) {
    /*
     * `url` is the caller's own-bucket list scope, not `sourceUrl` itself
     * (see `getPublicationsListScope`'s doc comment) — Core has no
     * per-resource filter, so every publication in this bucket is fetched
     * and narrowed to this entity by `resolvePublicationsForSource` below —
     * which has to re-read each candidate individually, because this list
     * response carries publication metadata only and no `resources` array.
     *
     * The scope comes from the session `bucket`, never from the entity id:
     * only some entity ids are full `{type}/{bucket}/{name}` resource paths.
     * A deployment id can be a bare name (`gemini-pro-vision`), which made
     * the extracted bucket `undefined` and the scope `publications/undefined/`;
     * a public resource (`applications/public/...`) yielded the admin-only
     * `publications/public/` scope instead. Both returned no history while
     * publishing kept working, which silently hid Unpublish.
     * `conversation-publish.service.ts` already scoped by session bucket.
     */
    return resolvePublicationsForSource(
      await this.listPublications(accessToken, bucket, context),
      sourceUrl,
      (url) => this.fetchPublication(accessToken, url),
      this.logger,
      context,
    );
  }

  /**
   * Every publication in the caller's bucket whose full record can be read,
   * `resources` included — whatever it publishes.
   *
   * @throws {BadGatewayException} When Core returns an unexpected error
   */
  private async listResolvedPublications(
    accessToken: string,
    bucket: string,
    context: string,
    isCandidate?: (status: string | undefined) => boolean,
  ) {
    return resolvePublicationDetails(
      await this.listPublications(accessToken, bucket, context),
      (url) => this.fetchPublication(accessToken, url),
      this.logger,
      context,
      isCandidate,
    );
  }

  /**
   * The caller's own publication list — metadata only, no `resources`.
   *
   * @throws {BadGatewayException} When Core returns an unexpected error
   */
  private async listPublications(
    accessToken: string,
    bucket: string,
    context: string,
  ) {
    const result = await this.dialClient.client.getPublications({
      headers: getBearerAuthHeaders(accessToken),
      body: { url: getPublicationsListScope(bucket) },
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get ${context}`,
        this.logger,
        result.error,
        extractDialErrorMessage(result.error),
      );
    }

    return toPublicationList<(typeof result.data)[number]>(
      result.data,
      this.logger,
      context,
    );
  }

  /**
   * The published copy of `sourceUrl` in `folderPath` that an unpublish must
   * remove: the newest live publication there, preferring one of `version`
   * when the folder holds several. `undefined` when none can be found.
   */
  private async findPublishedTargetUrl(
    accessToken: string,
    bucket: string,
    sourceUrl: string,
    folderPath: string,
    version: string | undefined,
  ): Promise<string | undefined> {
    const context = `published target of "${sourceUrl}" in "${folderPath}"`;
    let publications: Awaited<ReturnType<typeof this.listSourcePublications>>;
    try {
      publications = await this.listSourcePublications(
        accessToken,
        bucket,
        sourceUrl,
        context,
      );
    } catch (err) {
      /* The lookup only refines the target; the unpublish itself must not fail on it. */
      this.logger.warn(
        `Could not read ${context}; deriving it instead`,
        err instanceof Error ? err.stack : undefined,
      );
      return undefined;
    }
    const targetUrls = publications
      .filter(
        (publication) =>
          stripPublicTargetFolder(publication.targetFolder ?? '') ===
          folderPath,
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      )
      .map((publication) =>
        getPublicationSourceTargetUrl(publication, sourceUrl),
      )
      .filter((targetUrl): targetUrl is string => targetUrl != null);

    return (
      targetUrls.find(
        (targetUrl) => getPublishedVersion(targetUrl, undefined) === version,
      ) ?? targetUrls[0]
    );
  }

  /**
   * One publication's full record, including the `resources` array the list
   * call omits, or `null` when it cannot be read.
   *
   * Publish history is informational, so an unreadable publication is dropped
   * rather than propagated: one 403 among a bucket's publications must not take
   * down the publish panel for the whole entity.
   */
  private async fetchPublication(accessToken: string, url: string) {
    try {
      const result = await this.dialClient.client.getPublication({
        headers: getBearerAuthHeaders(accessToken),
        body: { url },
      });
      if (result.error) {
        this.logger.warn(
          `Skipping publication "${url}": DIAL Core returned ${result.response.status}`,
        );
        return null;
      }
      return result.data;
    } catch (err) {
      this.logger.warn(
        `Skipping unreadable publication "${url}"`,
        err instanceof Error ? err.stack : undefined,
      );
      return null;
    }
  }
}
