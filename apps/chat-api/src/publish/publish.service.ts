import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { mapDialHttpStatus } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import { CatalogEntityType } from './dto/catalog-entity-params.dto';
import { PublishHistoryEntryDto } from './dto/publish-history-entry.dto';
import { PublishResultDto } from './dto/publish-result.dto';

const historyCacheKey = (entityType: CatalogEntityType, entityId: string) =>
  `publish-history:${entityType}:${entityId}`;

/*
 * Confirmed against DIAL Core's own OpenAPI spec (`/v1/ops/publication/create`
 * documented example, https://dialx.ai/dial_api#tag/Publications/operation/createPublication):
 *
 *   targetFolder: public/folder/
 *   resources:
 *     - sourceUrl: conversations/{bucket}/my/folder/conversation
 *       targetUrl: conversations/public/folder/conversation
 *
 * `targetFolder` is `public/{folderPath}/` — REQUIRES a trailing slash (a
 * prior fix omitted it, which is what Core's `must start with: public and
 * ends with: /` 400 was actually complaining about). `targetUrl` IS a full
 * destination file path — `{resourceTypePrefix}/{targetFolder}{resourceName}`
 * — contrary to an earlier (incorrect) live-debugging conclusion that it
 * had to be folder-shaped; that conclusion was based on misreading which
 * field the error referred to. There is no opaque per-org bucket-id hash —
 * the shared Organization/public area is addressed by the literal segment
 * `public` (also matches the legacy pre-BFF frontend's `PUBLIC_URL_PREFIX`
 * in `apps/chat/src/constants/publication.ts` on `origin/development`).
 */
const PUBLIC_URL_PREFIX = 'public';

/** `entityId`'s first path segment, e.g. `applications` in `applications/{bucket}/{name}`. */
const getResourceTypePrefix = (entityId: string): string =>
  entityId.split('/')[0];

/** `entityId`'s last path segment, e.g. `{name}` in `applications/{bucket}/{name}`. */
const getResourceName = (entityId: string): string =>
  entityId.split('/').pop() ?? entityId;

/**
 * `public/{folderPath}/`, always trailing-slashed (bare `public/` at the
 * root). `folderPath` arrives as plain, unencoded text (e.g. `"test 14.04"`)
 * from the request body, but DIAL Core rejects resource urls containing raw
 * spaces/special characters (`Bad resource url: public/test 14.04/`) — each
 * segment is percent-encoded via `encodeDialResourcePath`, the same helper
 * `toolsets.service.ts`/`conversation.service.ts` use for every other
 * DIAL resource path built from user-supplied text.
 */
const getPublicTargetFolder = (folderPath: string): string =>
  folderPath
    ? `${PUBLIC_URL_PREFIX}/${encodeDialResourcePath(folderPath)}/`
    : `${PUBLIC_URL_PREFIX}/`;

/** Strips the leading `public/` segment and trailing slash DIAL Core returns in `Publication.targetFolder`, decoding each segment back to the plain folder path the frontend works with. */
const stripPublicTargetFolder = (targetFolder: string): string => {
  const prefix = `${PUBLIC_URL_PREFIX}/`;
  const withoutPrefix = targetFolder.startsWith(prefix)
    ? targetFolder.slice(prefix.length)
    : targetFolder;
  const withoutTrailingSlash = withoutPrefix.endsWith('/')
    ? withoutPrefix.slice(0, -1)
    : withoutPrefix;
  return withoutTrailingSlash.split('/').map(safeDecodeURIComponent).join('/');
};

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
 * Publishes catalog entities (Toolset, Application) to an Organization
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
    entityType: CatalogEntityType,
    entityId: string,
    folderPath: string,
    version: string,
    author: string,
  ): Promise<PublishResultDto> {
    const publicTargetFolder = getPublicTargetFolder(folderPath);
    const targetUrl = `${getResourceTypePrefix(entityId)}/${publicTargetFolder}${getResourceName(entityId)}`;
    const { name: entityName } = splitEntityNameAndVersion(entityId);
    const requestBody = {
      name: `${entityName} ${version}`,
      targetFolder: publicTargetFolder,
      resources: [{ action: 'ADD' as const, sourceUrl: entityId, targetUrl }],
      displayAuthor: author,
      rules: [],
    };
    // TODO(debug): remove once the DIAL Core 400 investigation is done.
    this.logger.debug(
      `createPublication request body: ${JSON.stringify(requestBody)}`,
    );

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
      // TODO(debug): remove once the DIAL Core 400 investigation is done.
      this.logger.debug(
        `createPublication error body: ${JSON.stringify(result.error)}`,
      );
      return mapDialHttpStatus(
        result.response.status,
        `publish ${entityType} "${entityId}"`,
        this.logger,
      );
    }

    await this.cacheManager.del(historyCacheKey(entityType, entityId));

    const publication = result.data;
    // TODO(debug): remove once the DIAL Core admin-visibility investigation is done.
    this.logger.debug(
      `createPublication response body: ${JSON.stringify(publication)}`,
    );
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
    entityType: CatalogEntityType,
    entityId: string,
  ): Promise<PublishHistoryEntryDto[]> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: historyCacheKey(entityType, entityId),
      ttlMs: 60 * 1000,
      context: `get publish history for ${entityType} "${entityId}"`,
      logger: this.logger,
      fetch: async () => {
        /*
         * Scoped by the entity's own resource url (not a folder) — history
         * spans every folder the entity has ever been published to; the
         * client filters by the currently selected folder itself.
         */
        // TODO(debug): remove once the DIAL Core admin-visibility investigation is done.
        this.logger.debug(
          `getPublications request body: ${JSON.stringify({ url: entityId })}`,
        );
        const result = await this.dialClient.client.getPublications({
          headers: getBearerAuthHeaders(accessToken),
          body: { url: entityId },
        });
        if (result.error) {
          // TODO(debug): remove once the DIAL Core 400 investigation is done.
          this.logger.debug(
            `getPublications error body: ${JSON.stringify(result.error)}`,
          );
          return mapDialHttpStatus(
            result.response.status,
            `get publish history for ${entityType} "${entityId}"`,
            this.logger,
          );
        }
        // TODO(debug): remove once the DIAL Core admin-visibility investigation is done.
        this.logger.debug(
          `getPublications response body: ${JSON.stringify(result.data)}`,
        );

        const { version } = splitEntityNameAndVersion(entityId);

        return (result.data ?? [])
          .filter((publication) =>
            publication.resources?.some(
              (resource) => resource.sourceUrl === entityId,
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
