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
  handleDialSdkError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type { PublishRuleDto } from '../publish/dto/publish-rule.dto';
import {
  resolvePublicationsForSource,
  toPublicationList,
} from '../publish/publication.util';
import {
  getPublicationsListScope,
  getPublicTargetFolder,
  getPublishedTargetUrl,
  getResourceName,
  stripPublicTargetFolder,
} from '../publish/publish-target.util';
import { PublishConversationResultDto } from './dto/publish-conversation-result.dto';
import { UnpublishConversationResultDto } from './dto/unpublish-conversation-result.dto';

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
 * `ConversationPersistenceService.getConversation`, whose cross-bucket path
 * resolution (`resolveConversationLocation` in `utils/conversation.utils.ts`)
 * exists to support reading a *shared* conversation from another user's
 * bucket. Publish has no such cross-bucket case — the title fetched here and
 * the `sourceUrl` built below must always refer to the exact same own-bucket
 * resource, so there is no window where they could resolve to different
 * buckets.
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
    rules?: PublishRuleDto[],
  ): Promise<PublishConversationResultDto> {
    const encodedPath = encodeDialResourcePath(path);
    const sourceUrl = `${CONVERSATION_RESOURCE_PREFIX}/${bucket}/${encodedPath}`;

    /* Re-fetches the conversation's current title server-side, scoped to the
     * caller's own bucket only, rather than trusting a client-supplied value. */
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
    const targetUrl = getPublishedTargetUrl(
      CONVERSATION_RESOURCE_PREFIX,
      folderPath,
      getResourceName(sourceUrl),
    );

    const requestBody = {
      name: conversation.name,
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
        result.error,
        extractDialErrorMessage(result.error),
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
   * Submits a removal request for one already-published folder of a
   * conversation. DIAL Core models removal as a *publication* whose single
   * resource carries `action: 'DELETE'` — the same `createPublication` call
   * and the same `PENDING → APPROVED/REJECTED` lifecycle publish goes
   * through, so this returns a submitted request, never a completed removal.
   * The published copy stays visible to everyone who could already see it
   * until an administrator approves.
   *
   * Like publish, this has no cross-bucket case: the copy being removed was
   * published from the caller's own bucket, so `sourceUrl` and the title
   * fetch both resolve against the session `bucket` only.
   *
   * @throws {NotFoundException} When the conversation or target folder is unknown
   * @throws {ForbiddenException} When the caller lacks write access to `folderPath`
   * @throws {BadGatewayException} When Core returns an unexpected error
   * @throws {ServiceUnavailableException} When Core is unreachable or times out
   */
  async unpublish(
    accessToken: string,
    bucket: string,
    path: string,
    folderPath: string,
    author: string,
  ): Promise<UnpublishConversationResultDto> {
    const encodedPath = encodeDialResourcePath(path);
    const sourceUrl = `${CONVERSATION_RESOURCE_PREFIX}/${bucket}/${encodedPath}`;

    /*
     * The title is re-fetched for the same reason publish re-fetches it: the
     * admin queue shows `Publication.name`, and a DELETE request with no
     * readable title is unreviewable. A failed fetch aborts before any
     * publication is created, so a request that cannot be labelled is never
     * submitted.
     */
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
        `conversations.unpublish (fetch title for "${sourceUrl}")`,
        this.logger,
        getResponse,
      );
    }

    const publicTargetFolder = getPublicTargetFolder(folderPath);
    const targetUrl = getPublishedTargetUrl(
      CONVERSATION_RESOURCE_PREFIX,
      folderPath,
      getResourceName(sourceUrl),
    );

    /*
     * `sourceUrl` is sent even though Core allows it to be omitted for a
     * `DELETE` action: it keeps the resource shape identical to the ADD one
     * publish sends. `rules` is omitted entirely.
     */
    const requestBody = {
      name: conversation.name,
      targetFolder: publicTargetFolder,
      resources: [{ action: 'DELETE' as const, sourceUrl, targetUrl }],
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
        `Unexpected error requesting unpublish of conversation "${sourceUrl}"`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new BadGatewayException(
        'Failed to submit unpublish request to DIAL Core',
      );
    }

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `unpublish conversation "${sourceUrl}"`,
        this.logger,
        result.error,
        extractDialErrorMessage(result.error),
      );
    }

    await this.cacheManager.del(historyCacheKey(sourceUrl));

    const publication = result.data;
    this.logger.debug(
      `Requested unpublish of conversation "${sourceUrl}" from "${folderPath}"`,
    );

    return {
      path: sourceUrl,
      folderPath,
      requestedAt: publication.createdAt
        ? new Date(publication.createdAt).toISOString()
        : new Date().toISOString(),
      requestedBy: publication.author ?? publication.displayAuthor ?? '',
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
         * fetched and narrowed to this conversation by
         * `resolvePublicationsForSource` below — which has to re-read each
         * candidate individually, because this list response carries
         * publication metadata only and no `resources` array.
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
            result.error,
            extractDialErrorMessage(result.error),
          );
        }

        const publications = await resolvePublicationsForSource(
          toPublicationList<(typeof result.data)[number]>(
            result.data,
            this.logger,
            `publish history for conversation "${sourceUrl}"`,
          ),
          sourceUrl,
          (url) => this.fetchPublication(accessToken, url),
          this.logger,
          `publish history for conversation "${sourceUrl}"`,
        );

        return publications
          .map((publication): PublishConversationResultDto => ({
            path: sourceUrl,
            folderPath: stripPublicTargetFolder(publication.targetFolder ?? ''),
            publishedAt: publication.createdAt
              ? new Date(publication.createdAt).toISOString()
              : '',
            publishedBy: publication.author ?? publication.displayAuthor ?? '',
          }))
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      },
    });
  }
  /**
   * One publication's full record, including the `resources` array the list
   * call omits, or `null` when it cannot be read.
   *
   * Publish history is informational, so an unreadable publication is dropped
   * rather than propagated: one 403 among a bucket's publications must not take
   * down the publish panel for the whole conversation.
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
