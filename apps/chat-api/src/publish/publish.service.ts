import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  extractDialErrorMessage,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import { toPromptResourceUrl } from '../prompts/utils/prompt-mapper.util';
import { CatalogEntityType } from './dto/catalog-entity-params.dto';
import { PublishHistoryEntryDto } from './dto/publish-history-entry.dto';
import { PublishResultDto } from './dto/publish-result.dto';
import type { PublishRuleDto } from './dto/publish-rule.dto';
import {
  getPublicationsListScope,
  getPublicTargetFolder,
  getResourceBucket,
  getResourceName,
  getResourceTypePrefix,
  stripPublicTargetFolder,
} from './publish-target.util';

/*
 * This service does NOT inject SkillsLookupService (design.md D9 in
 * openspec/changes/add-skills-bff-api). `splitEntityNameAndVersion` below
 * already degrades gracefully for a skill entityId with no `{name}__{version}`
 * suffix (empty version string), and no verified consumer of this service
 * currently needs a resolved skill name/version beyond that — see the open
 * questions in the `catalog-publish-api` delta spec (skill publish-history
 * version recovery, nested-grouping-folder targetUrl collision) before
 * adding one. Re-read that rationale before "fixing" this.
 */
const historyCacheKey = (entityType: CatalogEntityType, entityId: string) =>
  `publish-history:${entityType}:${entityId}`;

/*
 * Every other entity kind is addressed by a full DIAL Core resource path, so
 * `entityId` is already the Publication API's `sourceUrl`. A prompt's id is
 * bucket-relative (`Work/AI/summarize`), the form the prompts endpoints
 * return, and is qualified here with the caller's own bucket.
 */
const toSourceUrl = (
  entityType: CatalogEntityType,
  entityId: string,
  bucket: string,
): string =>
  entityType === CatalogEntityType.Prompt
    ? toPromptResourceUrl(entityId, bucket)
    : entityId;

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
  const separatorIndex = resourceName.lastIndexOf('__');
  if (separatorIndex === -1) {
    return { name: safeDecodeURIComponent(resourceName), version: '' };
  }
  return {
    name: safeDecodeURIComponent(resourceName.slice(0, separatorIndex)),
    version: resourceName.slice(separatorIndex + 2),
  };
};

/**
 * Publishes catalog entities (Toolset, Application, Prompt) to an Organization
 * folder and reads their publish history by proxying DIAL Core's
 * Publication API (`createPublication`/`getPublications`) — this service
 * holds no persistence of its own. `apps/chat-api` has no database, and Core
 * is the sole source of truth (see design.md D3 for why chat-api-side
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
  ) {}

  /**
   * @throws {NotFoundException} When Core reports the entity or folder as unknown
   * @throws {ForbiddenException} When the caller lacks write access to `folderPath`
   * @throws {BadGatewayException} When Core returns an unexpected error
   * @throws {ServiceUnavailableException} When Core is unreachable or times out
   */
  async publish(
    accessToken: string,
    bucket: string,
    entityType: CatalogEntityType,
    entityId: string,
    folderPath: string,
    version: string,
    author: string,
    rules?: PublishRuleDto[],
  ): Promise<PublishResultDto> {
    const sourceUrl = toSourceUrl(entityType, entityId, bucket);
    const publicTargetFolder = getPublicTargetFolder(folderPath);
    const targetUrl = `${getResourceTypePrefix(sourceUrl)}/${publicTargetFolder}${getResourceName(sourceUrl)}`;
    const { name: entityName } = splitEntityNameAndVersion(sourceUrl);
    const requestBody = {
      /* A prompt carries no version, so the title must not gain a trailing space. */
      name: `${entityName} ${version}`.trim(),
      targetFolder: publicTargetFolder,
      resources: [{ action: 'ADD' as const, sourceUrl, targetUrl }],
      displayAuthor: author,
      rules: rules ?? [],
    };
    let result;
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

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `publish ${entityType} "${entityId}"`,
        this.logger,
        result.error,
        extractDialErrorMessage(result.error),
      );
    }

    await this.cacheManager.del(historyCacheKey(entityType, entityId));

    const publication = result.data;
    this.logger.debug(
      `Published ${entityType} "${entityId}" to "${folderPath}"`,
    );

    return {
      entityId,
      entityType,
      folderPath,
      version,
      publishedAt: publication.createdAt
        ? new Date(publication.createdAt).toISOString()
        : new Date().toISOString(),
      publishedBy: publication.author ?? publication.displayAuthor ?? '',
    };
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
    const sourceUrl = toSourceUrl(entityType, entityId, bucket);
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: historyCacheKey(entityType, entityId),
      ttlMs: 60 * 1000,
      context: `get publish history for ${entityType} "${entityId}"`,
      logger: this.logger,
      fetch: async () => {
        /*
         * `url` is the caller's own-bucket list scope, not `entityId` itself
         * (see `getPublicationsListScope`'s doc comment) — Core has no
         * per-resource filter, so every publication in this bucket is
         * fetched and narrowed to this entity via `resources[].sourceUrl`
         * below.
         */
        const result = await this.dialClient.client.getPublications({
          headers: getBearerAuthHeaders(accessToken),
          body: { url: getPublicationsListScope(getResourceBucket(sourceUrl)) },
        });
        if (result.error) {
          return mapDialHttpStatus(
            result.response.status,
            `get publish history for ${entityType} "${entityId}"`,
            this.logger,
            result.error,
            extractDialErrorMessage(result.error),
          );
        }
        const { version } = splitEntityNameAndVersion(sourceUrl);

        return (result.data ?? [])
          .filter((publication) =>
            publication.resources?.some(
              (resource) => resource.sourceUrl === sourceUrl,
            ),
          )
          .map(
            (publication): PublishHistoryEntryDto => ({
              entityId,
              entityType,
              folderPath: stripPublicTargetFolder(
                publication.targetFolder ?? '',
              ),
              version,
              publishedAt: publication.createdAt
                ? new Date(publication.createdAt).toISOString()
                : '',
              publishedBy:
                publication.author ?? publication.displayAuthor ?? '',
            }),
          )
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      },
    });
  }
}
