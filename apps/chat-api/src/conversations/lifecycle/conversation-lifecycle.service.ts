import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { UserConfigService } from '../../user-config/user-config.service';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import {
  ConversationDeletionFailureDto,
  ConversationDeletionResultDto,
} from '../dto/delete-conversations.dto';
import { DuplicateConversationResponseDto } from '../dto/duplicate-conversation.dto';
import { MessageCustomContentDto } from '../dto/message-custom-content.dto';
import { RenameConversationResponseDto } from '../dto/rename-conversation.dto';
import { ConversationPersistenceService } from '../persistence/conversation-persistence.service';
import type { MetadataResult } from '../types/conversation.types';
import {
  buildConversationUrl,
  getConversationName,
  getConversationTitleFromName,
  getDeploymentKey,
  prepareEntityName,
  qualifySessionConversationPath,
  resolveConversationLocation,
} from '../utils/conversation.utils';

const isHttpLikeError = (e: unknown): e is { status: number } =>
  typeof e === 'object' &&
  e != null &&
  'status' in e &&
  typeof (e as Record<string, unknown>).status === 'number';

@Injectable()
export class ConversationLifecycleService {
  private readonly logger = new Logger(ConversationLifecycleService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly userConfigService: UserConfigService,
    private readonly persistenceService: ConversationPersistenceService,
  ) {}

  async createConversation(
    firstMessage: string,
    token: string,
    bucket: string,
    deploymentId: string,
    customContent?: MessageCustomContentDto,
  ): Promise<ConversationResponseDto> {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    const baseName = getConversationName('New chat', firstMessage);
    const name = baseName;
    const conversationPath = `${deploymentId}__${baseName}__${uuid}`;
    const folderId = `${bucket}`; // TODO: check

    const userMessage: ConversationMessageDto = {
      id: uuid,
      role: ConversationMessageRole.User,
      content: firstMessage,
      timestamp: new Date(now).toISOString(),
      custom_content: customContent,
    };

    // TODO: add temperature and other conversation settings
    const conversation: ConversationResponseDto = {
      id: `${folderId}/${conversationPath}`,
      folderId,
      name,
      model: { id: deploymentId },
      prompt: '',
      temperature: 1,
      messages: [userMessage],
      lastActivityDate: now,
      updatedAt: now,
      selectedAddons: [],
      assistantModelId: deploymentId,
    };

    try {
      const encodedConversationPath = encodeDialResourcePath(conversationPath);
      const { data, error, response } =
        await this.dialClient.client.saveConversation(
          bucket,
          encodedConversationPath,
          {
            headers: getBearerAuthHeaders(token),
            body: conversation as never,
          },
        );
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialSdkError(
          error,
          'conversations.createConversation',
          this.logger,
          response,
        );
      }

      return { ...data, ...conversation } as ConversationResponseDto;
    } catch (error) {
      this.logger.error('DIAL Core rejected saveConversation', error);
      return handleDialSdkError(
        error,
        'conversations.createConversation',
        this.logger,
      );
    }
  }

  async pinConversation(
    conversationId: string,
    isPinned: boolean,
    token: string,
    bucket: string,
  ): Promise<void> {
    return this.userConfigService.updatePin(
      conversationId,
      isPinned,
      token,
      bucket,
    );
  }

  async deleteConversation(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    try {
      const { error, response } =
        await this.dialClient.client.deleteConversation(
          bucket,
          encodeDialResourcePath(conversationPath),
          { headers: getBearerAuthHeaders(token) },
        );
      if (error != null) {
        this.logger.error('DIAL Core rejected deleteConversation', error);
        handleDialSdkError(
          error,
          'conversations.deleteConversation',
          this.logger,
          response,
        );
      }
    } catch (error) {
      this.logger.error('DIAL Core rejected deleteConversation', error);
      handleDialSdkError(
        error,
        'conversations.deleteConversation',
        this.logger,
      );
    }

    // Remove from pins if present — fire-and-forget, non-fatal
    void this.pinConversation(
      buildConversationUrl(bucket, conversationPath),
      false,
      token,
      bucket,
    ).catch((err) =>
      this.logger.error('Failed to clean up pin on delete', err),
    );
  }

  async renameConversation(
    conversationPath: string,
    newTitle: string,
    token: string,
    bucket: string,
  ): Promise<RenameConversationResponseDto> {
    const sanitisedTitle = prepareEntityName(newTitle);
    const qualifiedPath = qualifySessionConversationPath(
      conversationPath,
      bucket,
    );

    let stored: ConversationResponseDto;
    try {
      ({ conversation: stored } =
        await this.persistenceService.getStoredConversation(
          qualifiedPath,
          token,
          bucket,
        ));
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversation (rename)', error);
      throw new NotFoundException('Conversation not found');
    }

    const { bucket: saveBucket, subPath } = resolveConversationLocation(
      qualifiedPath,
      bucket,
    );

    const { error: saveError, response: saveResponse } =
      await this.dialClient.client.saveConversation(
        saveBucket,
        encodeDialResourcePath(subPath),
        {
          headers: getBearerAuthHeaders(token),
          body: {
            ...stored,
            name: sanitisedTitle,
            llmNamingDone: true,
          } as never,
        },
      );

    if (saveError != null) {
      this.logger.error('DIAL Core rejected saveConversation (rename)', {
        error: saveError,
      });
      return handleDialSdkError(
        saveError,
        'conversations.renameConversation',
        this.logger,
        saveResponse,
      );
    }

    return { name: sanitisedTitle };
  }

  async duplicateConversation(
    sourcePath: string,
    token: string,
    sessionBucket: string,
  ): Promise<DuplicateConversationResponseDto> {
    const slashIndex = sourcePath.indexOf('/');
    const sourceBucket =
      slashIndex === -1 ? sessionBucket : sourcePath.slice(0, slashIndex);
    const subPath =
      slashIndex === -1 ? sourcePath : sourcePath.slice(slashIndex + 1);

    /*
     * `subPath` arrives percent-encoded (it comes from a resource URL). Each
     * `/`-separated segment is one path component; a literal slash inside a
     * component (e.g. a deployment name "Team/App One") is encoded as %2F.
     */
    const segments = subPath.split('/');
    const encodedFilename = segments.at(-1) ?? subPath;
    const decodedFilename = safeDecodeURIComponent(encodedFilename);
    const decodedFolderSegments = segments
      .slice(0, -1)
      .map(safeDecodeURIComponent);

    /*
     * Read source first so we can use its `name` field (which may have been
     * updated by LLM naming without renaming the storage path).
     */
    const {
      data: sourceData,
      error: readError,
      response: readResponse,
    } = (await this.dialClient.client.getConversation(
      sourceBucket,
      encodeDialResourcePath(subPath),
      { headers: getBearerAuthHeaders(token) },
    )) as {
      data?: ConversationResponseDto;
      error?: unknown;
      response: globalThis.Response;
    };
    if (readError != null || !sourceData) {
      this.logger.error(
        'Could not read source conversation for duplicate',
        readError,
      );
      return handleDialSdkError(
        readError,
        'conversations.duplicateConversation',
        this.logger,
        readResponse,
      );
    }

    /*
     * Prefer the stored `name` field (set by LLM naming) over the path-derived
     * title so that conversations renamed by the model keep that name in the copy.
     */
    const pathTitle = getConversationTitleFromName(decodedFilename);
    const sourceTitle = sourceData.name?.trim() || pathTitle;
    const uniqueTitle = prepareEntityName(sourceTitle);

    const deploymentKey = getDeploymentKey(decodedFilename);
    const decodedRenamedFilename = `${deploymentKey}__${uniqueTitle}`;
    const pathExists = await this.conversationPathExists(
      token,
      sessionBucket,
      [...decodedFolderSegments, decodedRenamedFilename].join('/'),
    );
    const decodedFinalFilename = pathExists
      ? `${decodedRenamedFilename}__${crypto.randomUUID()}`
      : decodedRenamedFilename;
    const decodedDestinationSubPath = [
      ...decodedFolderSegments,
      decodedFinalFilename,
    ].join('/');
    const encodedDestinationSubPath = [
      ...decodedFolderSegments.map(encodeURIComponent),
      encodeURIComponent(decodedFinalFilename),
    ].join('/');

    const destinationUrl = buildConversationUrl(
      sessionBucket,
      encodedDestinationSubPath,
    );

    const folderId = decodedFolderSegments.length
      ? `${sessionBucket}/${decodedFolderSegments.join('/')}`
      : sessionBucket;

    const { error: saveError, response: saveResponse } =
      await this.dialClient.client.saveConversation(
        sessionBucket,
        encodedDestinationSubPath,
        {
          headers: getBearerAuthHeaders(token),
          body: {
            ...sourceData,
            id: `${sessionBucket}/${decodedDestinationSubPath}`,
            folderId,
            name: uniqueTitle,
            updatedAt: Date.now(),
          } as never,
        },
      );
    if (saveError != null) {
      this.logger.error('Could not save duplicated conversation', saveError);
      return handleDialSdkError(
        saveError,
        'conversations.duplicateConversation',
        this.logger,
        saveResponse,
      );
    }

    return { newPath: destinationUrl };
  }

  async deleteConversations(
    ids: string[],
    token: string,
    bucket: string,
  ): Promise<ConversationDeletionResultDto> {
    const uniqueIds = [...new Set(ids)];
    const ownedIds: string[] = [];
    const failed: ConversationDeletionFailureDto[] = [];

    for (const id of uniqueIds) {
      if (this.isOwnedBySessionBucket(id, bucket)) {
        ownedIds.push(id);
      } else {
        failed.push({ id, code: 'FORBIDDEN' });
      }
    }

    const prefix = `conversations/${bucket}/`;
    this.logger.debug(
      `deleteConversations: bucket=${bucket} total=${uniqueIds.length} owned=${ownedIds.length}`,
    );

    /*
     * IDs from the metadata listing are already URL-encoded (e.g. %20 for spaces).
     * Decode each segment before passing to encodeDialResourcePath to avoid
     * double-encoding (%20 → %2520).
     */
    const pathsForDelete = ownedIds.map((id) => {
      const rawPath = id.slice(prefix.length);
      return rawPath.split('/').map(safeDecodeURIComponent).join('/');
    });

    const results = await Promise.allSettled(
      pathsForDelete.map((path, i) => {
        const encodedPath = encodeDialResourcePath(path);
        this.logger.debug(
          `deleteConversations[${i}]: decodedPath=${path} encodedPath=${encodedPath}`,
        );
        return this.dialClient.client.deleteConversation(bucket, encodedPath, {
          headers: getBearerAuthHeaders(token),
        });
      }),
    );

    let deleted = 0;
    let alreadyAbsent = 0;

    for (const [i, id] of ownedIds.entries()) {
      const result = results[i];

      if (result.status === 'fulfilled') {
        const { error } = result.value as { error?: unknown };
        if (error == null) {
          deleted++;
          void this.pinConversation(id, false, token, bucket).catch((err) =>
            this.logger.error('Failed to clean up pin on bulk delete', err),
          );
        } else if (isHttpLikeError(error) && error.status === 404) {
          alreadyAbsent++;
        } else if (isHttpLikeError(error) && error.status === 403) {
          failed.push({ id, code: 'FORBIDDEN' });
        } else {
          this.logger.error(
            `deleteConversations[${i}] UPSTREAM_ERROR id=${id} errorStatus=${isHttpLikeError(error) ? error.status : 'n/a'} error=${JSON.stringify(error)}`,
          );
          failed.push({ id, code: 'UPSTREAM_ERROR' });
        }
      } else {
        this.logger.error(
          `deleteConversations[${i}] threw unexpectedly id=${id}`,
          (result.reason as Error | undefined)?.stack,
        );
        failed.push({ id, code: 'UPSTREAM_ERROR' });
      }
    }

    return { requested: uniqueIds.length, deleted, alreadyAbsent, failed };
  }

  async deleteAllConversations(
    token: string,
    bucket: string,
  ): Promise<ConversationDeletionResultDto> {
    const allIds: string[] = [];
    let cursor: string | undefined;

    try {
      do {
        const { data, error } =
          (await this.dialClient.client.getConversationMetadata(bucket, '', {
            headers: getBearerAuthHeaders(token),
            params: {
              query: {
                recursive: true,
                limit: 1000,
                ...(cursor ? { token: cursor } : {}),
              },
            },
          })) as MetadataResult;

        if (error != null || !data) {
          this.logger.error(
            'DIAL Core metadata listing failed during deleteAll',
            (error as Error | undefined)?.stack,
          );
          throw new BadGatewayException('DIAL Core metadata listing failed');
        }

        for (const item of data?.items ?? []) {
          if (item.nodeType !== 'FOLDER') {
            const id =
              item.url ?? `${item.parentPath ?? ''}/${item.name ?? ''}`;
            allIds.push(id);
          }
        }

        cursor = data?.nextToken ?? undefined;
      } while (cursor != null && cursor !== '');
    } catch (err) {
      if (
        err instanceof BadGatewayException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      this.logger.error(
        'DIAL Core metadata listing threw during deleteAll',
        (err as Error | undefined)?.stack,
      );
      if (
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.name === 'TimeoutError' ||
            err.message.includes('ECONNREFUSED') ||
            err.message.includes('ENOTFOUND') ||
            err.message.includes('fetch failed')))
      ) {
        throw new ServiceUnavailableException('DIAL Core is unreachable');
      }
      throw new BadGatewayException('DIAL Core metadata listing failed');
    }

    this.logger.debug(
      `deleteAllConversations: listed ${allIds.length} item(s) from bucket=${bucket}`,
    );

    if (allIds.length === 0) {
      return { requested: 0, deleted: 0, alreadyAbsent: 0, failed: [] };
    }

    return this.deleteConversations(allIds, token, bucket);
  }

  private async conversationPathExists(
    token: string,
    bucket: string,
    relativePath: string,
  ): Promise<boolean> {
    try {
      const { data, error, response } =
        (await this.dialClient.client.getConversationMetadata(
          bucket,
          encodeDialResourcePath(relativePath),
          { headers: getBearerAuthHeaders(token) },
        )) as {
          data?: unknown;
          error?: unknown;
          response?: globalThis.Response;
        };

      if (error != null) {
        if (response?.status === 404) {
          return false;
        }
        this.logger.warn(
          `Path collision check failed for "${relativePath}"; using UUID suffix`,
          error,
        );
        return true;
      }

      return data != null;
    } catch (error) {
      this.logger.warn(
        `Path collision check threw for "${relativePath}"; using UUID suffix`,
        error,
      );
      return true;
    }
  }

  private isOwnedBySessionBucket(id: string, sessionBucket: string): boolean {
    const prefix = `conversations/${sessionBucket}/`;
    if (!id.startsWith(prefix)) return false;
    const rawPath = id.slice(prefix.length);
    return !rawPath.split('/').some((seg) => seg === '..');
  }
}
