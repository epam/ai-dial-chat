import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, HttpException, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import {
  encodeDialFilePath,
  toPlainDialPath,
} from '../files/dial-resource-path.util';
import {
  type ConversationAttachmentView,
  resolvePublishedAttachments,
} from './utils/conversation-attachments.util';
import { resolveConversationLocation } from './utils/conversation.utils';

const PUBLIC_FILES_PREFIX = `files/${PUBLIC_BUCKET}/`;

/** How long "does this published copy exist" is remembered; the answer only changes when an administrator approves a publication or a removal. */
const PUBLISHED_COPY_TTL_MS = 60 * 1000;

const publishedCopyCacheKey = (publishedUrl: string) =>
  `conversation-published-attachment:${publishedUrl}`;

/**
 * Makes the attachments of a published conversation readable for everyone who
 * opens it.
 *
 * DIAL Core rewrites only the `url` of published message attachment files, so
 * folder links, stage and citation attachments and `reference_url` still point
 * at the author's private bucket. Publish also copies those files into a
 * folder named after the published conversation, keyed by source bucket; this
 * service rewrites a reference to its published copy when that copy exists,
 * and leaves any other reference exactly as stored. A failed lookup is never
 * read as "does not exist": it fails the call, so nothing is saved or shown
 * with a link that would stay private.
 */
@Injectable()
export class PublishedFolderAttachmentsService {
  private readonly logger = new Logger(PublishedFolderAttachmentsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Returns `conversation` with its attachment references resolved when it
   * lives in the public bucket, and unchanged otherwise.
   * @param conversation - the conversation body as stored
   * @param conversationPath - its path, qualified or relative to the session bucket
   * @param token - caller's bearer token
   * @param sessionBucket - caller's session bucket
   * @throws {HttpException} When DIAL Core fails to answer whether a published copy exists (anything but 404)
   */
  async resolve<C extends ConversationAttachmentView>(
    conversation: C,
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<C> {
    const { bucket, subPath } = resolveConversationLocation(
      conversationPath,
      sessionBucket,
    );
    if (bucket !== PUBLIC_BUCKET) return conversation;

    return resolvePublishedAttachments(
      conversation,
      `conversations/${PUBLIC_BUCKET}/${encodeDialResourcePath(subPath)}`,
      (publishedUrl) => this.publishedCopyExists(publishedUrl, token),
    );
  }

  /**
   * Whether a published file exists, or, for a url with a trailing `/`,
   * whether the folder holds anything. Only a definite answer is cached.
   */
  private async publishedCopyExists(
    publishedUrl: string,
    token: string,
  ): Promise<boolean> {
    const cacheKey = publishedCopyCacheKey(publishedUrl);
    const cached = await this.cacheManager.get<boolean>(cacheKey);
    if (cached != null) return cached;

    const exists = await this.lookup(publishedUrl, token);
    await this.cacheManager.set(cacheKey, exists, PUBLISHED_COPY_TTL_MS);
    return exists;
  }

  private async lookup(publishedUrl: string, token: string): Promise<boolean> {
    const isFolder = publishedUrl.endsWith('/');
    try {
      const { data, error, response } =
        await this.dialClient.client.getFileMetadata(
          PUBLIC_BUCKET,
          encodeDialFilePath(
            toPlainDialPath(publishedUrl.slice(PUBLIC_FILES_PREFIX.length)),
          ),
          {
            headers: getBearerAuthHeaders(token),
            params: { query: { limit: 1, recursive: false } },
          },
        );

      if (response.status === 404) return false;
      if (error != null || data == null || response.status >= 300) {
        this.logger.warn(
          `Could not check published attachment "${publishedUrl}" (status ${response.status})`,
        );
        return handleDialSdkError(
          error,
          'conversations.publishedAttachmentLookup',
          this.logger,
          response,
        );
      }

      return isFolder
        ? ((data as { items?: unknown[] }).items?.length ?? 0) > 0
        : true;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.warn(
        `Could not check published attachment "${publishedUrl}"`,
        err instanceof Error ? err.stack : undefined,
      );
      return handleDialSdkError(
        err,
        'conversations.publishedAttachmentLookup',
        this.logger,
      );
    }
  }
}
