import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import {
  encodeDialFilePath,
  toPlainDialPath,
} from '../files/dial-resource-path.util';
import { resolvePublishedFolderAttachments } from './utils/conversation-attachments.util';
import { resolveConversationLocation } from './utils/conversation.utils';

const PUBLIC_FILES_PREFIX = `files/${PUBLIC_BUCKET}/`;

/** How long "does this published folder hold files" is remembered; the answer only changes when an administrator approves a publication or a removal. */
const FOLDER_EXISTS_TTL_MS = 60 * 1000;

const folderExistsCacheKey = (publishedFolderUrl: string) =>
  `conversation-published-folder:${publishedFolderUrl}`;

/**
 * Makes the folder attachments of a published conversation readable for
 * everyone who opens it.
 *
 * DIAL Core rewrites the links of published files but never a folder link, so
 * the published copy still points at the author's private folder. Publish also
 * copies the folder's files into a folder named after the published
 * conversation; this service rewrites a folder attachment to that folder when
 * it exists, and leaves any other folder attachment exactly as stored.
 */
@Injectable()
export class PublishedFolderAttachmentsService {
  private readonly logger = new Logger(PublishedFolderAttachmentsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Returns `conversation` with its folder attachments resolved when it lives
   * in the public bucket, and unchanged otherwise.
   * @param conversation - the conversation body as stored
   * @param conversationPath - its path, qualified or relative to the session bucket
   * @param token - caller's bearer token
   * @param sessionBucket - caller's session bucket
   */
  async resolve<T>(
    conversation: T,
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<T> {
    const { bucket, subPath } = resolveConversationLocation(
      conversationPath,
      sessionBucket,
    );
    if (bucket !== PUBLIC_BUCKET) return conversation;

    return resolvePublishedFolderAttachments(
      conversation,
      `conversations/${PUBLIC_BUCKET}/${encodeDialResourcePath(subPath)}`,
      (publishedFolderUrl) => this.folderExists(publishedFolderUrl, token),
    );
  }

  /**
   * Whether a published folder holds anything. A failure other than "not
   * found" counts as "no" for this read but is not cached, so a brief DIAL
   * Core error cannot hide a folder for a minute.
   */
  private async folderExists(
    publishedFolderUrl: string,
    token: string,
  ): Promise<boolean> {
    const cacheKey = folderExistsCacheKey(publishedFolderUrl);
    const cached = await this.cacheManager.get<boolean>(cacheKey);
    if (cached != null) return cached;

    try {
      const { data, response } = await this.dialClient.client.getFileMetadata(
        PUBLIC_BUCKET,
        encodeDialFilePath(
          toPlainDialPath(publishedFolderUrl.slice(PUBLIC_FILES_PREFIX.length)),
        ),
        {
          headers: getBearerAuthHeaders(token),
          params: { query: { limit: 1, recursive: false } },
        },
      );

      if (response.status === 404) {
        await this.cacheManager.set(cacheKey, false, FOLDER_EXISTS_TTL_MS);
        return false;
      }
      if (data == null || response.status >= 300) {
        this.logger.warn(
          `Could not check published folder "${publishedFolderUrl}" (status ${response.status})`,
        );
        return false;
      }

      const exists = ((data as { items?: unknown[] }).items?.length ?? 0) > 0;
      await this.cacheManager.set(cacheKey, exists, FOLDER_EXISTS_TTL_MS);
      return exists;
    } catch (err) {
      this.logger.warn(
        `Could not check published folder "${publishedFolderUrl}"`,
        err instanceof Error ? err.stack : undefined,
      );
      return false;
    }
  }
}
