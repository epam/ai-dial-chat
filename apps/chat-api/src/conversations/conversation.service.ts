import {
  BadGatewayException,
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { StringUtils } from '../common/utils/string-utils';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { HIDDEN_FILE } from '../constants/dial.constants';
import { DeploymentsService } from '../deployments/deployments.service';
import { DialClientService } from '../dial/dial-client.service';
import {
  ConversationMetadataDto,
  ConversationResponseDto,
} from '../openapi/openapi-response.dto';
import { ScheduledTaskUnreadService } from '../scheduled-task-unread/scheduled-task-unread.service';
import { UserConfigService } from '../user-config/user-config.service';
import {
  MAX_LIST_DISPLAY_NAME_ENRICHMENTS,
  PUBLIC_BUCKET,
} from './constants/conversation.constants';
import {
  ConversationGenerationService,
  GenerationStatus,
} from './conversation-generation.service';
import { ConversationNamingService } from './conversation-naming.service';
import {
  ConversationListItemDto,
  ConversationListResponseDto,
} from './dto/conversation-list.dto';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from './dto/conversation-message.dto';
import {
  ConversationDeletionFailureDto,
  ConversationDeletionResultDto,
} from './dto/delete-conversations.dto';
import { DuplicateConversationResponseDto } from './dto/duplicate-conversation.dto';
import { MessageCustomContentDto } from './dto/message-custom-content.dto';
import { RenameConversationResponseDto } from './dto/rename-conversation.dto';
import { CompletionMode } from './dto/send-completion.dto';
import { ChatCompletionsAdapter } from './generation/chat-completions.adapter';
import {
  GenerationApi,
  resolveGenerationApi,
} from './generation/generation-api';
import {
  generationCapabilityResolutionTotal,
  generationRequestsTotal,
  generationStreamDuration,
  generationTimeToFirstDelta,
} from './generation/generation-metrics';
import type { GenerationRelayTiming } from './generation/generation.types';
import { ResponsesAdapter } from './generation/responses.adapter';
import type {
  MetadataItem,
  MetadataResult,
  SharedResourcesResult,
} from './types/conversation.types';
import { buildConversationHistory } from './utils/conversation-history-builder';
import {
  buildConversationUrl,
  getDeploymentKey,
  decodeNextToken,
  encodeCompoundToken,
  getConversationName,
  getConversationTitleFromName,
  prepareEntityName,
} from './utils/conversation.utils';
import { parseScheduledTaskConversationPath } from './utils/parse-scheduled-task-conversation-path';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly userConfigService: UserConfigService,
    private readonly scheduledTaskUnreadService: ScheduledTaskUnreadService,
    private readonly generationService: ConversationGenerationService,
    @Inject(forwardRef(() => ConversationNamingService))
    private readonly conversationNamingService: ConversationNamingService,
    private readonly deploymentsService: DeploymentsService,
    private readonly chatCompletionsAdapter: ChatCompletionsAdapter,
    private readonly responsesAdapter: ResponsesAdapter,
  ) {}

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

  async getConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<ConversationResponseDto> {
    try {
      const { conversation, subPath } = await this.getStoredConversation(
        conversationPath,
        token,
        sessionBucket,
      );
      const filename = subPath.split('/').pop() ?? subPath;
      const pathTitle = getConversationTitleFromName(
        safeDecodeURIComponent(filename),
      );
      const resolvedName = this.resolveListDisplayTitle(
        pathTitle,
        conversation,
      );
      return resolvedName === conversation.name
        ? conversation
        : { ...conversation, name: resolvedName };
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversation', error);
      return handleDialSdkError(
        error,
        'conversations.getConversation',
        this.logger,
      );
    }
  }

  private resolveConversationLocation(
    conversationPath: string,
    sessionBucket: string,
  ): { bucket: string; subPath: string } {
    if (
      conversationPath === sessionBucket ||
      conversationPath.startsWith(`${sessionBucket}/`)
    ) {
      return {
        bucket: sessionBucket,
        subPath:
          conversationPath === sessionBucket
            ? ''
            : conversationPath.slice(sessionBucket.length + 1),
      };
    }

    if (
      conversationPath === PUBLIC_BUCKET ||
      conversationPath.startsWith(`${PUBLIC_BUCKET}/`)
    ) {
      return {
        bucket: PUBLIC_BUCKET,
        subPath:
          conversationPath === PUBLIC_BUCKET
            ? ''
            : conversationPath.slice(PUBLIC_BUCKET.length + 1),
      };
    }

    const slashIndex = conversationPath.indexOf('/');
    if (slashIndex !== -1) {
      return {
        bucket: conversationPath.slice(0, slashIndex),
        subPath: conversationPath.slice(slashIndex + 1),
      };
    }
    return { bucket: sessionBucket, subPath: conversationPath };
  }

  private qualifySessionConversationPath(
    conversationPath: string,
    sessionBucket: string,
  ): string {
    return conversationPath === sessionBucket ||
      conversationPath.startsWith(`${sessionBucket}/`)
      ? conversationPath
      : `${sessionBucket}/${conversationPath}`;
  }

  private async getStoredConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<{ conversation: ConversationResponseDto; subPath: string }> {
    const { bucket, subPath } = this.resolveConversationLocation(
      conversationPath,
      sessionBucket,
    );

    const { data, error, response } =
      (await this.dialClient.client.getConversation(
        bucket,
        encodeDialResourcePath(subPath),
        { headers: getBearerAuthHeaders(token) },
      )) as {
        data?: unknown;
        error?: unknown;
        response: globalThis.Response;
      };
    if (error != null || !data) {
      this.logger.debug(
        `getStoredConversation rejected — bucket: ${bucket}, subPath: ${subPath}, status: ${response.status}, error: ${JSON.stringify(error)}`,
      );
      handleDialSdkError(
        error,
        'conversations.getStoredConversation',
        this.logger,
        response,
      );
    }

    return {
      conversation: data as ConversationResponseDto,
      subPath,
    };
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

  async markConversationViewed(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    return this.scheduledTaskUnreadService.markViewed(
      buildConversationUrl(bucket, conversationPath),
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
    const qualifiedPath = this.qualifySessionConversationPath(
      conversationPath,
      bucket,
    );

    let stored: ConversationResponseDto;
    try {
      ({ conversation: stored } = await this.getStoredConversation(
        qualifiedPath,
        token,
        bucket,
      ));
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversation (rename)', error);
      throw new NotFoundException('Conversation not found');
    }

    const { bucket: saveBucket, subPath } = this.resolveConversationLocation(
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

  async generateTitle(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<string> {
    const qualifiedPath = this.qualifySessionConversationPath(
      conversationPath,
      bucket,
    );
    return this.conversationNamingService.generateTitle(
      qualifiedPath,
      token,
      bucket,
    );
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

  async listConversations(
    token: string,
    bucket: string,
    limit = 100,
    nextToken?: string,
  ): Promise<ConversationListResponseDto> {
    const { u: userNextToken, p: publicNextToken } = decodeNextToken(nextToken);

    const buildQuery = (cursor?: string) => ({
      recursive: true as const,
      limit,
      ...(cursor ? { token: cursor } : {}),
    });

    try {
      const [userResult, publicResult, sharedResult, pinnedIds, viewedIds] =
        await Promise.all([
          this.dialClient.client.getConversationMetadata(bucket, '', {
            headers: getBearerAuthHeaders(token),
            params: {
              query: { ...buildQuery(userNextToken), permissions: true },
            },
          }) as Promise<MetadataResult & { response: globalThis.Response }>,
          (
            this.dialClient.client.getConversationMetadata(PUBLIC_BUCKET, '', {
              headers: getBearerAuthHeaders(token),
              params: { query: buildQuery(publicNextToken) },
            }) as Promise<MetadataResult>
          ).catch((err: unknown) => {
            this.logger.warn(
              'DIAL Core listConversations (public bucket) failed',
              err,
            );
            return { data: undefined, error: err } satisfies MetadataResult;
          }),
          (
            this.dialClient.client.getSharedResources({
              headers: getBearerAuthHeaders(token),
              body: { resourceTypes: ['CONVERSATION'], with: 'me' },
            }) as Promise<SharedResourcesResult>
          ).catch((err: unknown) => {
            this.logger.warn(
              'DIAL Core listConversations (shared resources) failed',
              err,
            );
            return {
              data: undefined,
              error: err,
            } satisfies SharedResourcesResult;
          }),
          this.userConfigService.getPinnedIds(token, bucket),
          this.scheduledTaskUnreadService.getViewedIds(token, bucket),
        ]);

      const {
        data: userData,
        error: userError,
        response: userResponse,
      } = userResult;

      if (userError !== undefined || !userData) {
        this.logger.error(
          'DIAL Core rejected listConversations (user bucket)',
          userError,
        );
        return handleDialSdkError(
          userError,
          'conversations.listConversations',
          this.logger,
          userResponse,
        );
      }

      const resolvedUserData: { items?: MetadataItem[]; nextToken?: string } =
        userData;

      const { data: publicData, error: publicError } = publicResult;
      if (publicError !== undefined) {
        this.logger.warn(
          'DIAL Core rejected listConversations (public bucket)',
          publicError,
        );
      }

      const { data: sharedData, error: sharedError } = sharedResult;
      if (sharedError !== undefined) {
        this.logger.warn(
          'DIAL Core listConversations (shared resources) failed',
          sharedError,
        );
      }

      const pinnedSet = new Set(pinnedIds.map(safeDecodeURIComponent));
      const viewedSet = new Set(viewedIds.map(safeDecodeURIComponent));

      const mapItems = (
        items: MetadataItem[],
        overrides: {
          sharedWithMe?: boolean;
          publishedWithMe?: boolean;
          isReadonly?: boolean;
        } = {},
      ): ConversationListItemDto[] =>
        items
          .filter((item) => item.nodeType !== 'FOLDER')
          .map((item) => {
            const id =
              item.url ?? `${item.parentPath ?? ''}/${item.name ?? ''}`;
            const decodedId = safeDecodeURIComponent(id);
            const isReadonly =
              overrides.isReadonly ??
              !(item.permissions?.includes('WRITE') ?? false);
            const scheduledTask = parseScheduledTaskConversationPath(id);
            return {
              id,
              title: getConversationTitleFromName(item.name ?? ''),
              updatedAt: item.updatedAt ?? 0,
              sharedWithMe:
                overrides.sharedWithMe ?? item.sharedWithMe ?? false,
              publishedWithMe:
                overrides.publishedWithMe ?? item.publishedWithMe ?? false,
              isPinned: pinnedSet.has(decodedId),
              isReadonly,
              isScheduledTask: scheduledTask !== null,
              ...(scheduledTask !== null
                ? {
                    scheduleId: scheduledTask.scheduleId,
                    runId: scheduledTask.runId,
                    isUnread: !viewedSet.has(decodedId),
                  }
                : {}),
            };
          });

      /*
       * The user's personal-bucket copy and its public-bucket copy (if the
       * conversation has been published) are always returned as two
       * independent list items, each with its own resource id — a personal,
       * writable entry and a separate, read-only public entry. They are
       * intentionally not merged/deduplicated: matching them by relative
       * path is unreliable (publish lets the user pick an arbitrary target
       * folder, so the public path rarely mirrors the personal one), and
       * merging previously caused the personal copy's pin state to be lost
       * and any link built from the merged item to point at the wrong
       * bucket. Keeping both means every link/pin/permission stays scoped
       * to the bucket it actually belongs to.
       */
      const userItems = mapItems(resolvedUserData.items ?? []);

      const publicItems =
        publicError == null && publicData
          ? mapItems(publicData.items ?? [], {
              publishedWithMe: true,
              isReadonly: true,
            })
          : [];
      const sharedItems =
        sharedError == null && sharedData
          ? (sharedData.resources ?? [])
              .filter((r) => r.nodeType !== 'FOLDER')
              .map((r) => {
                const id = r.url ?? `${r.parentPath ?? ''}/${r.name ?? ''}`;
                const decodedId = safeDecodeURIComponent(id);
                const scheduledTask = parseScheduledTaskConversationPath(id);
                return {
                  id,
                  title: getConversationTitleFromName(r.name ?? ''),
                  updatedAt: 0,
                  sharedWithMe: true,
                  publishedWithMe: false,
                  isPinned: pinnedSet.has(decodedId),
                  isReadonly: true,
                  isScheduledTask: scheduledTask !== null,
                  ...(scheduledTask !== null
                    ? {
                        scheduleId: scheduledTask.scheduleId,
                        runId: scheduledTask.runId,
                        isUnread: !viewedSet.has(decodedId),
                      }
                    : {}),
                };
              })
          : [];

      const items = await this.enrichListItemsWithStoredDisplayNames(
        [...userItems, ...publicItems, ...sharedItems]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .filter(
            (item) => item.id !== HIDDEN_FILE && !item.id.includes(HIDDEN_FILE),
          ),
        token,
        bucket,
      );

      return {
        items,
        nextToken: encodeCompoundToken(
          resolvedUserData.nextToken,
          publicData?.nextToken,
        ),
      };
    } catch (error) {
      this.logger.error('DIAL Core listConversations failed', error);
      return handleDialSdkError(
        error,
        'conversations.listConversations',
        this.logger,
      );
    }
  }

  async getConversationMetadata(
    conversationPath: string,
    token: string,
    bucket: string,
    permissions?: boolean,
  ): Promise<ConversationMetadataDto> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getConversationMetadata(
          bucket,
          encodeDialResourcePath(conversationPath),
          {
            headers: getBearerAuthHeaders(token),
            params:
              permissions !== undefined
                ? { query: { permissions } }
                : undefined,
          },
        );
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected getConversationMetadata', error);
        return handleDialSdkError(
          error,
          'conversations.getConversationMetadata',
          this.logger,
          response,
        );
      }
      return data as ConversationMetadataDto;
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversationMetadata', error);
      return handleDialSdkError(
        error,
        'conversations.getConversationMetadata',
        this.logger,
      );
    }
  }

  async saveConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    const bodyToSave = await this.preserveLlmDisplayName(
      conversationPath,
      token,
      bucket,
      conversation,
    );

    try {
      const { data, error, response } =
        await this.dialClient.client.saveConversation(
          bucket,
          encodeDialResourcePath(conversationPath),
          {
            headers: getBearerAuthHeaders(token),
            body: bodyToSave as never,
          },
        );
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialSdkError(
          error,
          'conversations.saveConversation',
          this.logger,
          response,
        );
      }
      const saved = { ...data, ...bodyToSave } as ConversationResponseDto;
      if (saved.llmNamingDone !== true) {
        this.conversationNamingService.maybeRenameAfterFirstReply(
          conversationPath,
          token,
          bucket,
          saved,
        );
      }
      return saved;
    } catch (error) {
      this.logger.error('DIAL Core rejected saveConversation', error);
      return handleDialSdkError(
        error,
        'conversations.saveConversation',
        this.logger,
      );
    }
  }

  /**
   * Client saves often carry a stale message-derived `name`. Once LLM naming has
   * persisted a display title, later saves must not overwrite it.
   */
  private async preserveLlmDisplayName(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    if (conversation.llmNamingDone === true) {
      return conversation;
    }

    try {
      const { conversation: existing } = await this.getStoredConversation(
        this.qualifySessionConversationPath(conversationPath, bucket),
        token,
        bucket,
      );
      if (existing.llmNamingDone === true && existing.name?.trim()) {
        return {
          ...conversation,
          name: existing.name,
          llmNamingDone: true,
        };
      }
    } catch {
      // New conversations or transient read failures keep the incoming body.
    }

    return conversation;
  }

  private getListItemRelativePath(itemId: string): string {
    const decodedId = safeDecodeURIComponent(itemId);
    const parts = decodedId.split('/');
    if (parts.length >= 3 && parts[0] === 'conversations') {
      return parts.slice(2).join('/');
    }
    if (parts.length >= 2) {
      return parts.slice(1).join('/');
    }
    return decodedId;
  }

  private async enrichListItemsWithStoredDisplayNames(
    items: ConversationListItemDto[],
    token: string,
    bucket: string,
  ): Promise<ConversationListItemDto[]> {
    const enrichable = items.filter(
      (item) => !item.isReadonly && !item.sharedWithMe && !item.publishedWithMe,
    );
    if (enrichable.length === 0) {
      return items;
    }

    const candidates = [...enrichable]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_LIST_DISPLAY_NAME_ENRICHMENTS);

    const displayNameById = new Map<string, string>();
    const batchSize = 25;

    for (let index = 0; index < candidates.length; index += batchSize) {
      const batch = candidates.slice(index, index + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const conversation = await this.getStoredConversation(
              this.qualifySessionConversationPath(
                this.getListItemRelativePath(item.id),
                bucket,
              ),
              token,
              bucket,
            );
            const displayName = this.resolveListDisplayTitle(
              item.title,
              conversation.conversation,
            );
            if (displayName) {
              displayNameById.set(item.id, displayName);
            }
          } catch {
            // Keep the filename-derived title when the body cannot be read.
          }
        }),
      );
    }

    return items.map((item) => {
      const displayName = displayNameById.get(item.id);
      return displayName ? { ...item, title: displayName } : item;
    });
  }

  private resolveListDisplayTitle(
    pathTitle: string,
    conversation: ConversationResponseDto,
  ): string {
    const storedName = conversation.name?.trim();
    if (!storedName) {
      return pathTitle;
    }
    if (storedName === pathTitle) {
      return storedName;
    }

    /* `llmNamingDone` marks `name` as authoritative — set by LLM naming and by
     * manual rename, both of which update `name` at the same storage path, so
     * the filename-derived title may legitimately diverge from it.
     */
    return conversation.llmNamingDone === true ? storedName : pathTitle;
  }

  private isOwnedBySessionBucket(id: string, sessionBucket: string): boolean {
    const prefix = `conversations/${sessionBucket}/`;
    if (!id.startsWith(prefix)) return false;
    const rawPath = id.slice(prefix.length);
    return !rawPath.split('/').some((seg) => seg === '..');
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

  async watchConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const { bucket, subPath } = this.resolveConversationLocation(
      this.qualifySessionConversationPath(conversationPath, sessionBucket),
      sessionBucket,
    );
    const resourceUrl = buildConversationUrl(
      bucket,
      encodeDialResourcePath(subPath),
    );
    this.logger.debug(
      `watchConversation subscribing to resource: ${resourceUrl}`,
    );

    try {
      const result = (await this.dialClient.client.subscribeToResources({
        body: { resources: [{ url: resourceUrl }] },
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
        },
        parseAs: 'stream',
      })) as { response: globalThis.Response; error?: unknown };

      if (!result.response.ok || !result.response.body) {
        this.logger.error(
          `DIAL Core rejected subscribeToResources — status: ${result.response.status}`,
        );
        return handleDialSdkError(
          { status: result.response.status },
          'conversations.watchConversation',
          this.logger,
        );
      }
      return result.response.body;
    } catch (error) {
      this.logger.error('DIAL Core subscribeToResources failed', error);
      return handleDialSdkError(
        error,
        'conversations.watchConversation',
        this.logger,
      );
    }
  }

  /**
   * Resolves the generation API for `model` under the caller's own access
   * token — never trusting a value the browser might have sent — by reading
   * `features` off `DeploymentsService.getDeploymentDetails`'s cached,
   * user-token-scoped result. A toolset target is rejected with 400, since
   * toolsets are not generation deployments.
   *
   * Also derives `temperatureSupported` from the same already-fetched
   * `features` object, so the Responses request builder can capability-gate
   * `temperature` without a second `getDeploymentDetails` call for the same
   * generation (see `responses-api-generation` spec).
   */
  private async resolveGenerationApiForDeployment(
    sub: string,
    model: string,
    token: string,
  ): Promise<{ generationApi: GenerationApi; temperatureSupported: boolean }> {
    const details = await this.deploymentsService.getDeploymentDetails(
      sub,
      model,
      token,
    );

    if (details.type === 'toolset') {
      const safeModel = StringUtils.sanitizeForLog(model);
      throw new BadRequestException(
        `Deployment "${safeModel}" is a toolset and cannot be used for generation`,
      );
    }

    const features =
      details.type === 'application'
        ? details.applicationDetails?.features
        : details.modelDetails?.features;

    return {
      generationApi: resolveGenerationApi(features),
      temperatureSupported: features?.temperature === true,
    };
  }

  async streamCompletion(
    conversationPath: string,
    token: string,
    bucket: string,
    generationId: string,
    mode: CompletionMode,
    message: string | undefined,
    messageIndex: number | undefined,
    model: string,
    customContent: MessageCustomContentDto | undefined,
    sessionId: string,
    res: Response,
    sub: string,
    clientChannelId?: string,
  ): Promise<void> {
    const safeModel = StringUtils.sanitizeForLog(model);
    this.logger.debug(
      `streamCompletion start — model: ${safeModel}, bucket: ${bucket}, path: ${conversationPath}, mode: ${mode}`,
    );

    const abortController = this.generationService.register(
      sessionId,
      conversationPath,
      generationId,
    );

    let generationApi: GenerationApi;
    let temperatureSupported: boolean;
    try {
      ({ generationApi, temperatureSupported } =
        await this.resolveGenerationApiForDeployment(sub, model, token));
      generationCapabilityResolutionTotal.add(1, {
        outcome: 'resolved',
        'generation.api': generationApi,
      });
    } catch (err) {
      generationCapabilityResolutionTotal.add(1, { outcome: 'failed' });
      /*
       * Release the just-registered entry so a failure before streaming starts
       * doesn't leave the conversation "locked" — otherwise the next request
       * (e.g. regenerate) would be rejected with a 409 until stale eviction.
       */
      this.generationService.error(sessionId, conversationPath, generationId);
      throw err;
    }

    let startState: ReturnType<typeof buildConversationHistory>;
    try {
      const fetchedConversation = await this.getConversation(
        this.qualifySessionConversationPath(conversationPath, bucket),
        token,
        bucket,
      );
      startState = buildConversationHistory(
        mode,
        fetchedConversation,
        message,
        messageIndex,
        customContent,
      );
    } catch (err) {
      /*
       * Release the just-registered entry so a failure before streaming starts
       * doesn't leave the conversation "locked" — otherwise the next request
       * (e.g. regenerate) would be rejected with a 409 until stale eviction.
       */
      this.generationService.error(sessionId, conversationPath, generationId);
      throw err;
    }

    const { conversation: startConversation, assistantMessageIndex } =
      startState;

    try {
      await this.saveConversation(
        conversationPath,
        token,
        bucket,
        startConversation,
      );
    } catch (err) {
      this.logger.warn(
        'Failed to save start-state conversation, continuing stream',
        err,
      );
    }

    const messagesForCompletion = startConversation.messages.slice(
      0,
      assistantMessageIndex,
    );

    this.logger.debug(
      `streamCompletion sending ${messagesForCompletion.length} message(s) to model: ${safeModel} via ${generationApi}`,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const assembledMessage = {
      ...startConversation.messages[assistantMessageIndex],
    };

    const finalize = async (
      status:
        | GenerationStatus.Done
        | GenerationStatus.Stopped
        | GenerationStatus.Error,
      partialMessage: ConversationMessageDto,
    ): Promise<void> => {
      const finalConversation = {
        ...startConversation,
        messages: [
          ...startConversation.messages.slice(0, assistantMessageIndex),
          partialMessage,
        ],
      };
      try {
        await this.saveConversation(
          conversationPath,
          token,
          bucket,
          finalConversation,
        );
      } catch (err) {
        this.logger.warn(`Failed to save ${status} conversation`, err);
      }
      if (status === GenerationStatus.Done) {
        this.generationService.complete(
          sessionId,
          conversationPath,
          generationId,
        );
      } else {
        this.generationService.error(sessionId, conversationPath, generationId);
      }
    };

    const streamStartedAt = Date.now();
    const timing: GenerationRelayTiming = {};

    const relayResult =
      generationApi === GenerationApi.Responses
        ? await this.responsesAdapter.relay(
            this.responsesAdapter.buildRequest({
              model,
              startConversation,
              messagesForCompletion,
              temperatureSupported,
            }),
            token,
            abortController.signal,
            res,
            assembledMessage,
            clientChannelId,
            timing,
          )
        : await this.chatCompletionsAdapter.relay(
            model,
            this.chatCompletionsAdapter.buildRequest({
              startConversation,
              messagesForCompletion,
              customContent,
            }),
            token,
            abortController.signal,
            res,
            assembledMessage,
            clientChannelId,
            timing,
          );

    generationRequestsTotal.add(1, {
      'generation.api': generationApi,
      outcome: relayResult.outcome,
    });
    if (timing.firstDeltaAt != null) {
      generationTimeToFirstDelta.record(
        (timing.firstDeltaAt - streamStartedAt) / 1000,
        { 'generation.api': generationApi },
      );
    }
    generationStreamDuration.record((Date.now() - streamStartedAt) / 1000, {
      'generation.api': generationApi,
      outcome: relayResult.outcome,
    });

    switch (relayResult.outcome) {
      case 'rejected': {
        const errored = {
          ...relayResult.assembledMessage,
          custom_content: {
            ...relayResult.assembledMessage.custom_content,
            event_type: undefined,
          } as never,
          streamErrorMessage: relayResult.errorMessage,
        };
        await finalize(GenerationStatus.Error, errored);
        break;
      }
      case 'completed':
        await finalize(GenerationStatus.Done, relayResult.assembledMessage);
        break;
      case 'aborted': {
        const wasStopped =
          this.generationService.getStatus(sessionId, conversationPath) ===
          GenerationStatus.Stopped;
        const partialMsg = {
          ...relayResult.assembledMessage,
          ...(wasStopped
            ? { wasStoppedByUser: true }
            : { streamErrorMessage: '' }),
        } as ConversationMessageDto;
        await finalize(
          wasStopped ? GenerationStatus.Stopped : GenerationStatus.Error,
          partialMsg,
        );
        break;
      }
      case 'error': {
        this.logger.error(
          'DIAL Core streamCompletion failed',
          relayResult.error,
        );
        const errorMessage =
          relayResult.error instanceof Error ? relayResult.error.message : '';
        const partialMsg = {
          ...relayResult.assembledMessage,
          streamErrorMessage: errorMessage,
        } as ConversationMessageDto;
        await finalize(GenerationStatus.Error, partialMsg);
        break;
      }
    }

    if (!res.writableEnded) res.end();
  }
}

const isHttpLikeError = (e: unknown): e is { status: number } =>
  typeof e === 'object' &&
  e != null &&
  'status' in e &&
  typeof (e as Record<string, unknown>).status === 'number';
