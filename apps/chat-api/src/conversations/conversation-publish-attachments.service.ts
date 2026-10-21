import {
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment.config';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import {
  buildDialFileResourceUrl,
  toPlainDialPath,
} from '../files/dial-resource-path.util';
import { FilesListingService } from '../files/listing/files-listing.service';
import { getPublishedAttachmentTargetUrl } from '../publish/publish-target.util';
import { ConversationErrorCode } from './types/conversation-error-code.enum';
import { collectOwnedAttachmentRefs } from './utils/conversation-attachments.util';

/** Files whose existence is checked in one round of parallel requests. */
const EXISTENCE_CHECK_CONCURRENCY = 8;

const DEFAULT_PUBLISH_ATTACHMENTS_MAX_FILES = 1000;

/** A `resources` entry for a publication request. */
export interface PublicationFileResource {
  action: 'ADD' | 'DELETE';
  sourceUrl?: string;
  targetUrl: string;
}

/**
 * Works out which attachment files of a conversation are published with it
 * and removed with it, because DIAL Core publishes only the resources it is
 * told about and rejects a folder as a resource.
 *
 * Publish collects the author's own attachment files, expands attached folders
 * recursively and nests every file under the published conversation's own
 * folder; unpublish lists that folder to delete what was published.
 */
@Injectable()
export class ConversationPublishAttachmentsService {
  private readonly logger = new Logger(
    ConversationPublishAttachmentsService.name,
  );

  constructor(
    private readonly filesListingService: FilesListingService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * The `ADD` resources for the files a conversation's attachments reference.
   * Only files in the author's own bucket are included; a conversation without
   * any yields an empty list.
   * @param accessToken - caller's bearer token
   * @param bucket - caller's session bucket
   * @param conversation - the stored conversation body
   * @param folderPath - plain publish target folder
   * @param conversationResourceName - last segment of the conversation's path
   * @throws {UnprocessableEntityException} `conversationAttachmentMissing` when a referenced file or folder no longer exists
   * @throws {PayloadTooLargeException} When the attachments expand to more files than `PUBLISH_ATTACHMENTS_MAX_FILES`
   */
  async buildAddResources(
    accessToken: string,
    bucket: string,
    conversation: unknown,
    folderPath: string,
    conversationResourceName: string,
  ): Promise<PublicationFileResource[]> {
    const { fileUrls, folderUrls } = collectOwnedAttachmentRefs(
      conversation,
      bucket,
    );
    if (fileUrls.length === 0 && folderUrls.length === 0) return [];

    const maxFiles =
      this.configService.get('PUBLISH_ATTACHMENTS_MAX_FILES', {
        infer: true,
      }) ?? DEFAULT_PUBLISH_ATTACHMENTS_MAX_FILES;

    const missing = await this.findMissingFiles(accessToken, bucket, fileUrls);

    /*
     * Both forms go through the same canonical encoding, so a file attached
     * directly and the same file found inside an attached folder collapse
     * into one resource even when the stored url encodes it differently.
     */
    const sourceUrls = new Set<string>(
      fileUrls.map((fileUrl) =>
        buildDialFileResourceUrl(
          bucket,
          toPlainDialPath(fileUrl.split('/').slice(2).join('/')),
        ),
      ),
    );
    for (const folderUrl of folderUrls) {
      try {
        const expanded = await this.filesListingService.expandFolderContents(
          bucket,
          toPlainDialPath(folderUrl),
          '',
          accessToken,
        );
        for (const file of expanded) {
          sourceUrls.add(buildDialFileResourceUrl(bucket, file.path));
        }
      } catch (err) {
        if (!(err instanceof NotFoundException)) throw err;
        missing.push(folderUrl);
      }
    }

    if (missing.length > 0) {
      throw this.attachmentMissing(missing);
    }
    this.assertWithinLimit(sourceUrls.size, maxFiles);

    return [...sourceUrls].map((sourceUrl) => ({
      action: 'ADD' as const,
      sourceUrl,
      targetUrl: getPublishedAttachmentTargetUrl(
        folderPath,
        conversationResourceName,
        sourceUrl.split('/').slice(2).join('/'),
      ),
    }));
  }

  /**
   * The `DELETE` resources for the files published with a conversation, read
   * from what actually exists in its published folder: Core fails a `DELETE`
   * of a target that is gone, so the live listing is the only safe list.
   * @param accessToken - caller's bearer token
   * @param attachmentsFolderUrl - `files/public/{folder}/{name}/`, from `getPublishedAttachmentsFolderUrl`
   */
  async buildDeleteResources(
    accessToken: string,
    attachmentsFolderUrl: string,
  ): Promise<PublicationFileResource[]> {
    let expanded;
    try {
      expanded = await this.filesListingService.expandFolderContents(
        PUBLIC_BUCKET,
        toPlainDialPath(attachmentsFolderUrl),
        '',
        accessToken,
      );
    } catch (err) {
      if (err instanceof NotFoundException) return [];
      throw err;
    }

    return expanded.map((file) => ({
      action: 'DELETE' as const,
      targetUrl: buildDialFileResourceUrl(PUBLIC_BUCKET, file.path),
    }));
  }

  private assertWithinLimit(count: number, maxFiles: number): void {
    if (count > maxFiles) {
      this.logger.warn(
        `Conversation attachments expand to ${count} files, max is ${maxFiles}`,
      );
      throw new PayloadTooLargeException(
        `The conversation attachments contain ${count} files, max is ${maxFiles}`,
      );
    }
  }

  private async findMissingFiles(
    accessToken: string,
    bucket: string,
    fileUrls: string[],
  ): Promise<string[]> {
    const missing: string[] = [];
    for (
      let start = 0;
      start < fileUrls.length;
      start += EXISTENCE_CHECK_CONCURRENCY
    ) {
      const batch = fileUrls.slice(start, start + EXISTENCE_CHECK_CONCURRENCY);
      await Promise.all(
        batch.map(async (fileUrl) => {
          try {
            await this.filesListingService.getFileMetadata(
              bucket,
              toPlainDialPath(fileUrl.split('/').slice(2).join('/')),
              accessToken,
            );
          } catch (err) {
            if (!(err instanceof NotFoundException)) throw err;
            missing.push(fileUrl);
          }
        }),
      );
    }
    return missing;
  }

  private attachmentMissing(missingFiles: string[]) {
    return new UnprocessableEntityException({
      statusCode: 422,
      error: 'Unprocessable Entity',
      code: ConversationErrorCode.AttachmentMissing,
      message: `The conversation references attachment files that no longer exist: ${missingFiles.join(', ')}`,
      missingFiles,
    });
  }
}
