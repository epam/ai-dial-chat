import {
  BadGatewayException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { EnvironmentVariables } from '../config/environment.config';
import { HIDDEN_FILE } from '../constants/dial.constants';
import {
  ConversationMetadataDto,
  ConversationResponseDto,
} from '../openapi/openapi-response.dto';
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
import type {
  MetadataItem,
  MetadataResult,
  SharedResourcesResult,
} from './types/conversation.types';
import { applyChunkToMessage } from './utils/apply-chunk.server';
import { buildConversationHistory } from './utils/conversation-history-builder';
import {
  buildConversationUrl,
  buildRenamedConversationPath,
  getDeploymentKey,
  decodeNextToken,
  encodeCompoundToken,
  encodeDialResourcePath,
  getConversationName,
  getConversationTitleFromName,
  prepareEntityName,
} from './utils/conversation.utils';

const getValidAttachments = (
  customContent?: ConversationMessageDto['custom_content'],
) =>
  (customContent?.attachments ?? []).filter((attachment) =>
    Boolean(attachment.data || attachment.url),
  );

@Injectable()
export class ConversationService extends AppService {
  protected override logger = new Logger(ConversationService.name);

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    private readonly userConfigService: UserConfigService,
    private readonly generationService: ConversationGenerationService,
    @Inject(forwardRef(() => ConversationNamingService))
    private readonly conversationNamingService: ConversationNamingService,
  ) {
    super(configService);
  }

  private async conversationPathExists(
    token: string,
    bucket: string,
    relativePath: string,
  ): Promise<boolean> {
    try {
      const { data, error } = (await this.client.getConversationMetadata(
        bucket,
        encodeDialResourcePath(relativePath),
        { headers: getBearerAuthHeaders(token) },
      )) as { data?: unknown; error?: unknown };

      if (error != null) {
        if (isHttpLikeError(error) && error.status === 404) {
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
    const twoPartPath = `${deploymentId}__${baseName}`;
    const pathExists = await this.conversationPathExists(
      token,
      bucket,
      twoPartPath,
    );
    const conversationPath = pathExists
      ? `${deploymentId}__${baseName}__${uuid}`
      : twoPartPath;
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
      const encodedConversationPath = conversationPath
        .split('/')
        .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
        .join('/');
      const { data, error } = (await this.client.saveConversation(
        bucket,
        encodedConversationPath,
        {
          headers: getBearerAuthHeaders(token),
          body: conversation as never,
        },
      )) as { data?: unknown; error?: unknown };
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialError(error);
      }

      return { ...data, ...conversation } as ConversationResponseDto;
    } catch (error) {
      this.logger.error('DIAL Core rejected saveConversation', error);
      return handleDialError(error);
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
      return handleDialError(error);
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

    const { data, error } = (await this.client.getConversation(
      bucket,
      encodeDialResourcePath(subPath),
      { headers: getBearerAuthHeaders(token) },
    )) as { data?: unknown; error?: unknown };
    if (error != null || !data) {
      throw error ?? new Error('Conversation not found');
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

  async deleteConversation(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    try {
      const { error } = (await this.client.deleteConversation(
        bucket,
        encodeDialResourcePath(conversationPath),
        { headers: getBearerAuthHeaders(token) },
      )) as { data?: unknown; error?: unknown };
      if (error != null) {
        this.logger.error('DIAL Core rejected deleteConversation', error);
        handleDialError(error);
      }
    } catch (error) {
      this.logger.error('DIAL Core rejected deleteConversation', error);
      handleDialError(error);
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
    const renamedPath = buildRenamedConversationPath(
      conversationPath,
      sanitisedTitle,
    );

    const sourceUrl = `${buildConversationUrl(bucket, encodeDialResourcePath(conversationPath))}`;
    const destinationUrl = `${buildConversationUrl(bucket, encodeDialResourcePath(renamedPath))}`;

    let moveError: unknown = undefined;
    let moveStatus: number | undefined = undefined;
    try {
      const result = (await this.client.moveResource({
        headers: getBearerAuthHeaders(token),
        body: { sourceUrl, destinationUrl, overwrite: false },
      })) as { error?: unknown; response?: globalThis.Response };
      if (result.error != null) {
        moveError = result.error;
        moveStatus = result.response?.status;
      }
    } catch (error) {
      moveError = error;
    }

    if (moveError != null) {
      this.logger.error('DIAL Core moveResource (rename) failed', {
        status: moveStatus,
        error: moveError,
      });
      // DIAL Core bug: returns 400 with "Source resource ... does not exist" instead of 404.
      if (
        moveStatus === 400 &&
        typeof moveError === 'string' &&
        moveError.includes('does not exist')
      ) {
        throw new NotFoundException('Conversation not found');
      }
      return handleDialError(moveError);
    }

    // Migrate pin state: if the old conversation was pinned, point the pin at
    // the new path. Fire-and-forget, non-fatal (mirrors deleteConversation cleanup).
    const oldPinId = buildConversationUrl(bucket, conversationPath);
    const newPinId = buildConversationUrl(bucket, renamedPath);
    void this.userConfigService
      .migratePin(oldPinId, newPinId, token, bucket)
      .catch((err) =>
        this.logger.error('Failed to migrate pin on rename', err),
      );

    await this.syncStoredDisplayNameAfterPathRename(
      renamedPath,
      sanitisedTitle,
      token,
      bucket,
    );

    return { newPath: buildConversationUrl(bucket, renamedPath) };
  }

  /**
   * Path rename (moveResource) updates the filename only. Sync `conversation.name`
   * in the stored body so list enrichment and GET do not keep an LLM title.
   */
  private async syncStoredDisplayNameAfterPathRename(
    conversationPath: string,
    displayName: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const qualifiedPath = this.qualifySessionConversationPath(
      conversationPath,
      bucket,
    );
    try {
      const { conversation: data } = await this.getStoredConversation(
        qualifiedPath,
        token,
        bucket,
      );
      if (data.name?.trim() === displayName) {
        return;
      }

      const { bucket: saveBucket, subPath } = this.resolveConversationLocation(
        qualifiedPath,
        bucket,
      );

      const { error: saveError } = (await this.client.saveConversation(
        saveBucket,
        encodeDialResourcePath(subPath),
        {
          headers: getBearerAuthHeaders(token),
          body: { ...data, name: displayName } as never,
        },
      )) as { error?: unknown };
      if (saveError != null) {
        this.logger.warn(
          'Failed to sync display name after path rename',
          saveError,
        );
      }
    } catch (error) {
      this.logger.warn('Failed to sync display name after path rename', error);
    }
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

    // `subPath` arrives percent-encoded (it comes from a resource URL). Each
    // `/`-separated segment is one path component; a literal slash inside a
    // component (e.g. a deployment name "Team/App One") is encoded as %2F.
    const segments = subPath.split('/');
    const encodedFilename = segments.at(-1) ?? subPath;
    const decodedFilename = safeDecodeURIComponent(encodedFilename);
    const decodedFolderSegments = segments
      .slice(0, -1)
      .map(safeDecodeURIComponent);

    // Read source first so we can use its `name` field (which may have been
    // updated by LLM naming without renaming the storage path).
    const { data: sourceData, error: readError } =
      (await this.client.getConversation(
        sourceBucket,
        encodeDialResourcePath(subPath),
        { headers: getBearerAuthHeaders(token) },
      )) as { data?: ConversationResponseDto; error?: unknown };
    if (readError != null || !sourceData) {
      this.logger.error(
        'Could not read source conversation for duplicate',
        readError,
      );
      return handleDialError(readError);
    }

    // Prefer the stored `name` field (set by LLM naming) over the path-derived
    // title so that conversations renamed by the model keep that name in the copy.
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

    const { error: saveError } = (await this.client.saveConversation(
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
    )) as { error?: unknown };
    if (saveError != null) {
      this.logger.error('Could not save duplicated conversation', saveError);
      return handleDialError(saveError);
    }

    return { newPath: destinationUrl };
  }

  async listConversations(
    token: string,
    bucket: string,
    limit = 100,
    nextToken?: string,
    path?: string,
  ): Promise<ConversationListResponseDto> {
    const { u: userNextToken, p: publicNextToken } = decodeNextToken(nextToken);

    const buildQuery = (cursor?: string) => ({
      recursive: true as const,
      limit,
      ...(cursor ? { token: cursor } : {}),
    });

    try {
      const [userResult, publicResult, sharedResult, pinnedIds] =
        await Promise.all([
          this.client.getConversationMetadata(
            bucket,
            encodeDialResourcePath(path ?? ''),
            {
              headers: getBearerAuthHeaders(token),
              params: {
                query: { ...buildQuery(userNextToken), permissions: true },
              },
            },
          ) as Promise<MetadataResult>,
          (
            this.client.getConversationMetadata(
              PUBLIC_BUCKET,
              encodeDialResourcePath(path ?? ''),
              {
                headers: getBearerAuthHeaders(token),
                params: { query: buildQuery(publicNextToken) },
              },
            ) as Promise<MetadataResult>
          ).catch((err: unknown) => {
            this.logger.warn(
              'DIAL Core listConversations (public bucket) failed',
              err,
            );
            return { data: undefined, error: err } satisfies MetadataResult;
          }),
          (
            this.client.getSharedResources({
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
        ]);

      const { data: userData, error: userError } = userResult;
      if (userError !== undefined || !userData) {
        this.logger.error(
          'DIAL Core rejected listConversations (user bucket)',
          userError,
        );
        return handleDialError(userError);
      }

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
            };
          });

      // Extract the path within a bucket from a DIAL Core resource URL.
      // URL format: "conversations/<bucket>/<relative-path>"
      // Stripping the first two segments lets us match the same conversation
      // across different buckets (e.g. user bucket vs. public bucket).
      // Falls back to item.name when url is absent.
      const getBucketRelativePath = (item: MetadataItem): string => {
        if (item.url) {
          const parts = item.url.split('/');
          return parts.length >= 3 ? parts.slice(2).join('/') : item.url;
        }
        return item.name ?? '';
      };

      // Paths of public-bucket items on this page — used to:
      //   1. Skip public items that duplicate a user-bucket item (dedup)
      //   2. Promote user-bucket items that are org-published to publishedWithMe: true
      const publicItemPaths = new Set(
        publicError == null && publicData
          ? (publicData.items ?? [])
              .filter((item) => item.nodeType !== 'FOLDER')
              .map(getBucketRelativePath)
          : [],
      );

      // IDs of user-bucket items that also exist in the public bucket.
      // These should be shown as org-published (Organization section) rather
      // than My Chats, because DIAL Core may not set publishedWithMe on
      // user-bucket copies.
      const orgPublishedUserIds = new Set(
        (userData.items ?? [])
          .filter(
            (item) =>
              item.nodeType !== 'FOLDER' &&
              publicItemPaths.has(getBucketRelativePath(item)),
          )
          .map(
            (item) => item.url ?? `${item.parentPath ?? ''}/${item.name ?? ''}`,
          ),
      );

      const userItems = mapItems(userData.items ?? []).map((item) =>
        orgPublishedUserIds.has(item.id)
          ? { ...item, publishedWithMe: true }
          : item,
      );

      // Paths of user-bucket items on this page — used to skip public items
      // that are already represented as user items above.
      const userItemPaths = new Set(
        (userData.items ?? [])
          .filter((item) => item.nodeType !== 'FOLDER')
          .map(getBucketRelativePath),
      );

      const publicItems =
        publicError == null && publicData
          ? mapItems(
              (publicData.items ?? []).filter(
                (item) => !userItemPaths.has(getBucketRelativePath(item)),
              ),
              { publishedWithMe: true, isReadonly: true },
            )
          : [];
      const sharedItems =
        sharedError == null && sharedData
          ? (sharedData.resources ?? [])
              .filter((r) => r.nodeType !== 'FOLDER')
              .map((r) => {
                const id = r.url ?? `${r.parentPath ?? ''}/${r.name ?? ''}`;
                const decodedId = safeDecodeURIComponent(id);
                return {
                  id,
                  title: getConversationTitleFromName(r.name ?? ''),
                  updatedAt: 0,
                  sharedWithMe: true,
                  publishedWithMe: false,
                  isPinned: pinnedSet.has(decodedId),
                  isReadonly: true,
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
          userData.nextToken,
          publicData?.nextToken,
        ),
      };
    } catch (error) {
      this.logger.error('DIAL Core listConversations failed', error);
      return handleDialError(error);
    }
  }

  async getConversationMetadata(
    conversationPath: string,
    token: string,
    bucket: string,
    permissions?: boolean,
  ): Promise<ConversationMetadataDto> {
    try {
      const { data, error } = (await this.client.getConversationMetadata(
        bucket,
        encodeDialResourcePath(conversationPath),
        {
          headers: getBearerAuthHeaders(token),
          params:
            permissions !== undefined ? { query: { permissions } } : undefined,
        },
      )) as { data?: unknown; error?: unknown };
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected getConversationMetadata', error);
        return handleDialError(error);
      }
      return data as ConversationMetadataDto;
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversationMetadata', error);
      return handleDialError(error);
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
      const { data, error } = (await this.client.saveConversation(
        bucket,
        encodeDialResourcePath(conversationPath),
        {
          headers: getBearerAuthHeaders(token),
          body: bodyToSave as never,
        },
      )) as { data?: unknown; error?: unknown };
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialError(error);
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
      return handleDialError(error);
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

    if (conversation.llmNamingDone !== true) {
      return pathTitle;
    }

    const firstUserMessage = conversation.messages?.find(
      (message) => message.role === ConversationMessageRole.User,
    )?.content;
    const messageDerivedTitle = getConversationName(
      'New chat',
      firstUserMessage ?? '',
    );

    return pathTitle === messageDerivedTitle ? storedName : pathTitle;
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

    // IDs from the metadata listing are already URL-encoded (e.g. %20 for spaces).
    // Decode each segment before passing to encodeDialResourcePath to avoid
    // double-encoding (%20 → %2520).
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
        return this.client.deleteConversation(bucket, encodedPath, {
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
        const { data, error } = (await this.client.getConversationMetadata(
          bucket,
          '',
          {
            headers: getBearerAuthHeaders(token),
            params: {
              query: {
                recursive: true,
                limit: 1000,
                ...(cursor ? { token: cursor } : {}),
              },
            },
          },
        )) as MetadataResult;

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
      const result = (await this.client.subscribeToResources({
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
        return handleDialError({ status: result.response.status });
      }
      return result.response.body;
    } catch (error) {
      this.logger.error('DIAL Core subscribeToResources failed', error);
      return handleDialError(error);
    }
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
  ): Promise<void> {
    this.logger.debug(
      `streamCompletion start — model: ${model}, bucket: ${bucket}, path: ${conversationPath}, mode: ${mode}`,
    );

    const abortController = this.generationService.register(
      sessionId,
      conversationPath,
      generationId,
    );

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
      // Release the just-registered entry so a failure before streaming starts
      // doesn't leave the conversation "locked" — otherwise the next request
      // (e.g. regenerate) would be rejected with a 409 until stale eviction.
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

    const configuration =
      customContent?.configuration_value ??
      messagesForCompletion
        .filter((m) => m.custom_content?.configuration_value)
        .at(-1)?.custom_content?.configuration_value;

    const lastUserMessage =
      messagesForCompletion[messagesForCompletion.length - 1];
    const shouldHideCurrentConfigurationContent =
      customContent?.configuration_value !== undefined &&
      lastUserMessage?.role === ConversationMessageRole.User;

    const dialMessages = messagesForCompletion
      .filter((m) => m.role !== ConversationMessageRole.Status)
      .map((m, index, filteredMessages) => {
        const validAttachments = getValidAttachments(m.custom_content);
        const hasConfigurationValue =
          m.custom_content?.configuration_value !== undefined;
        const content = Object.fromEntries(
          Object.entries({
            ...m.custom_content,
            attachments: validAttachments.length ? validAttachments : undefined,
            configuration_value: undefined,
            stages: undefined,
          }).filter(([, value]) => value != null),
        );
        return {
          role: m.role,
          content:
            hasConfigurationValue ||
            (shouldHideCurrentConfigurationContent &&
              index === filteredMessages.length - 1)
              ? ''
              : m.content,
          ...(Object.keys(content).length > 0
            ? { custom_content: content }
            : {}),
        };
      });

    const systemMessages = startConversation.prompt
      ? [{ role: 'system', content: startConversation.prompt }]
      : [];

    const requestBody = {
      messages: [...systemMessages, ...dialMessages],
      stream: true,
      ...(startConversation.temperature != null && {
        temperature: startConversation.temperature,
      }),
      ...(configuration ? { custom_fields: { configuration } } : {}),
    };

    this.logger.debug(
      `streamCompletion sending ${dialMessages.length} message(s) to model: ${model}`,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let assembledMessage = {
      ...startConversation.messages[assistantMessageIndex],
    };
    let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

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

    try {
      const dialResult = (await this.client.sendChatCompletionRequest(model, {
        body: requestBody as never,
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
        },
        params: { query: { 'api-version': this.dialApiVersion } },
        parseAs: 'stream',
        signal: abortController.signal,
      })) as { response: globalThis.Response; error?: unknown };

      if (!dialResult.response.ok || !dialResult.response.body) {
        this.logger.error(
          `DIAL Core rejected streamCompletion — model: ${model}, status: ${dialResult.response.status}`,
        );
        assembledMessage = {
          ...assembledMessage,
          custom_content: {
            ...assembledMessage.custom_content,
            event_type: undefined,
          } as never,
        };
        (
          assembledMessage as ConversationMessageDto & {
            hasStreamError?: boolean;
          }
        ).hasStreamError = true;
        await finalize(GenerationStatus.Error, assembledMessage);
        if (!res.writableEnded) res.end();
        return;
      }

      upstreamReader = dialResult.response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let receivedDone = false;

      while (true) {
        const { done, value } = await upstreamReader.read();
        if (done) break;

        res.write(value);

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
              receivedDone = true;
              continue;
            }
            try {
              const parsed: unknown = JSON.parse(payload);
              assembledMessage = applyChunkToMessage(assembledMessage, parsed);
            } catch {
              // Malformed chunk — skip
            }
          }
        }

        // `[DONE]` is the SSE completion signal. Stop here rather than waiting
        // for the upstream socket to close — some providers keep the connection
        // open after `[DONE]`, which would otherwise leave this generation
        // registered as active and reject the next request (e.g. regenerate)
        // with a 409 conflict.
        if (receivedDone) break;
      }

      await finalize(GenerationStatus.Done, assembledMessage);
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'DOMException');

      if (isAbort) {
        const wasStopped =
          this.generationService.getStatus(sessionId, conversationPath) ===
          GenerationStatus.Stopped;
        const partialMsg = {
          ...assembledMessage,
          ...(wasStopped
            ? { wasStoppedByUser: true }
            : { hasStreamError: true }),
        } as ConversationMessageDto;
        await finalize(
          wasStopped ? GenerationStatus.Stopped : GenerationStatus.Error,
          partialMsg,
        );
      } else {
        this.logger.error('DIAL Core streamCompletion failed', err);
        const partialMsg = {
          ...assembledMessage,
          hasStreamError: true,
        } as ConversationMessageDto;
        await finalize(GenerationStatus.Error, partialMsg);
      }
    } finally {
      if (upstreamReader) {
        try {
          // cancel() (not releaseLock) so the upstream connection is closed
          // when we stop early on `[DONE]`, instead of being left dangling.
          await upstreamReader.cancel();
        } catch {
          /* already closed */
        }
      }
      if (!res.writableEnded) res.end();
    }
  }
}

const isHttpLikeError = (e: unknown): e is { status: number } =>
  typeof e === 'object' &&
  e != null &&
  'status' in e &&
  typeof (e as Record<string, unknown>).status === 'number';
