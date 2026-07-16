import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialSdkError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import {
  getPublicationsListScope,
  getPublicTargetFolder,
  getResourceName,
  stripPublicTargetFolder,
} from '../publish/publish-target.util';
import { PublishConversationResultDto } from './dto/publish-conversation-result.dto';

const CONVERSATION_RESOURCE_PREFIX = 'conversations';

const historyCacheKey = (sourceUrl: string) =>
  `conversation-publish-history:${sourceUrl}`;

/**
 * Publishes conversations to an Organization folder and reads their publish
 * history by proxying DIAL Core's Publication API (`createPublication`/
 * `getPublications`) — this service holds no persistence of its own, the
 * same non-persistence property as `apps/chat-api/src/publish/publish.service.ts`,
 * whose shared target-folder helpers this service reuses via
 * `publish-target.util.ts` (see design.md D1 for why this is a dedicated
 * service rather than an extension of the catalog `entityType` enum).
 *
 * The conversation path is always resolved against the caller's own session
 * `bucket` — deliberately calling `DialClientService.client.getConversation`
 * directly (bucket, path) rather than going through
 * `ConversationService.getConversation`, whose cross-bucket path resolution
 * (`resolveConversationLocation`) exists to support reading a *shared*
 * conversation from another user's bucket. Publish has no such cross-bucket
 * case — the title fetched here and the `sourceUrl` built below must always
 * refer to the exact same own-bucket resource, so there is no window where
 * they could resolve to different buckets.
 */
@Injectable()
export class ConversationPublishService {
  private readonly logger = new Logger(ConversationPublishService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * @throws {NotFoundException} When the conversation or target folder is unknown
   * @throws {ForbiddenException} When the caller lacks write access to `folderPath`
   * @throws {BadGatewayException} When Core returns an unexpected error
   * @throws {ServiceUnavailableException} When Core is unreachable or times out
   */
  async publish(
    accessToken: string,
    bucket: string,
    path: string,
    folderPath: string,
    author: string,
  ): Promise<PublishConversationResultDto> {
    const encodedPath = encodeDialResourcePath(path);
    const sourceUrl = `${CONVERSATION_RESOURCE_PREFIX}/${bucket}/${encodedPath}`;

    // Re-fetches the conversation's current title server-side, scoped to the
    // caller's own bucket only, rather than trusting a client-supplied value.
    const {
      data: conversation,
      error: getError,
      response: getResponse,
    } = (await this.dialClient.client.getConversation(bucket, encodedPath, {
      headers: getBearerAuthHeaders(accessToken),
    })) as {
      data?: { name: string };
      error?: unknown;
      response: globalThis.Response;
    };
    if (getError != null || conversation == null) {
      return handleDialSdkError(
        getError,
        `conversations.publish (fetch title for "${sourceUrl}")`,
        this.logger,
        getResponse,
      );
    }

    const publicTargetFolder = getPublicTargetFolder(folderPath);
    const targetUrl = `${CONVERSATION_RESOURCE_PREFIX}/${publicTargetFolder}${getResourceName(sourceUrl)}`;

    const requestBody = {
      name: conversation.name,
      targetFolder: publicTargetFolder,
      resources: [{ action: 'ADD' as const, sourceUrl, targetUrl }],
      displayAuthor: author,
      rules: [],
    };

    let result;
    try {
      result = await this.dialClient.client.createPublication({
        headers: getBearerAuthHeaders(accessToken),
        body: requestBody,
      });
    } catch (err) {
      this.logger.error(
        `Unexpected error publishing conversation "${sourceUrl}"`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new BadGatewayException('Failed to publish to DIAL Core');
    }

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `publish conversation "${sourceUrl}"`,
        this.logger,
      );
    }

    await this.cacheManager.del(historyCacheKey(sourceUrl));

    const publication = result.data;
    this.logger.debug(
      `Published conversation "${sourceUrl}" to "${folderPath}"`,
    );

    return {
      path: sourceUrl,
      folderPath,
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
    path: string,
  ): Promise<PublishConversationResultDto[]> {
    const encodedPath = encodeDialResourcePath(path);
    const sourceUrl = `${CONVERSATION_RESOURCE_PREFIX}/${bucket}/${encodedPath}`;

    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: historyCacheKey(sourceUrl),
      ttlMs: 60 * 1000,
      context: `get publish history for conversation "${sourceUrl}"`,
      logger: this.logger,
      fetch: async () => {
        /*
         * `url` is the caller's own-bucket list scope, not `sourceUrl` itself
         * (see `getPublicationsListScope`'s doc comment) — Core has no
         * per-resource filter, so every publication in this bucket is
         * fetched and narrowed to this conversation via
         * `resources[].sourceUrl` below.
         */
        const result = await this.dialClient.client.getPublications({
          headers: getBearerAuthHeaders(accessToken),
          body: { url: getPublicationsListScope(bucket) },
        });
        if (result.error) {
          return mapDialHttpStatus(
            result.response.status,
            `get publish history for conversation "${sourceUrl}"`,
            this.logger,
          );
        }

        return (result.data ?? [])
          .filter((publication) =>
            publication.resources?.some(
              (resource) => resource.sourceUrl === sourceUrl,
            ),
          )
          .map(
            (publication): PublishConversationResultDto => ({
              path: sourceUrl,
              folderPath: stripPublicTargetFolder(
                publication.targetFolder ?? '',
              ),
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
