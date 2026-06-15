import {
  Conversation,
  ConversationMetadata,
  Message,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import { ChatMessageRole, MessageDto } from '../chat/dto/chat-completion.dto';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import { EnvironmentVariables } from '../config/environment.config';
import { UserConfigService } from '../user-config/user-config.service';
import { PUBLIC_BUCKET } from './constants/conversation.constants';
import {
  ConversationListItemDto,
  ConversationListResponseDto,
} from './dto/conversation-list.dto';
import {
  ConversationDeletionFailureDto,
  ConversationDeletionResultDto,
} from './dto/delete-conversations.dto';
import { DuplicateConversationResponseDto } from './dto/duplicate-conversation.dto';
import { MessageCustomContentDto } from './dto/message-custom-content.dto';
import { RenameConversationResponseDto } from './dto/rename-conversation.dto';
import type {
  MetadataItem,
  MetadataResult,
  SharedResourcesResult,
} from './types/conversation.types';
import {
  buildConversationUrl,
  buildRenamedConversationPath,
  decodeNextToken,
  encodeCompoundToken,
  encodeDialResourcePath,
  getConversationName,
  getConversationTitleFromName,
  prepareEntityName,
  safeDecodeURIComponent,
} from './utils/conversation.utils';
import { resolveUniqueConversationName } from './utils/resolve-unique-conversation-name';

const getValidAttachments = (customContent?: Message['custom_content']) =>
  (customContent?.attachments ?? []).filter((attachment) =>
    Boolean(attachment.data || attachment.url),
  );

@Injectable()
export class ConversationService extends AppService {
  protected override logger = new Logger(ConversationService.name);

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    private readonly userConfigService: UserConfigService,
  ) {
    super(configService);
  }

  private async fetchAllUserTitles(
    token: string,
    bucket: string,
  ): Promise<Set<string>> {
    const titles = new Set<string>();
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

        if (error != null || !data) break;

        for (const item of data.items ?? []) {
          const filename = item.name ?? item.url?.split('/').at(-1);
          if (item.nodeType !== 'FOLDER' && filename) {
            titles.add(getConversationTitleFromName(filename));
          }
        }

        // DIAL Core may return nextToken as null (JSON null) when exhausted.
        // Treat both null and undefined as "no more pages".
        cursor = data.nextToken ?? undefined;
      } while (cursor != null && cursor !== '');
    } catch (error) {
      this.logger.warn(
        'Unable to finish conversation title lookup; continuing with collected titles',
        error,
      );
      // Resilient: return whatever was collected before the failure
    }

    return titles;
  }

  async createConversation(
    firstMessage: string,
    token: string,
    bucket: string,
    deploymentId: string,
    customContent?: MessageCustomContentDto,
  ): Promise<Conversation> {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    const baseName = getConversationName('New chat', firstMessage);
    const existingTitles = await this.fetchAllUserTitles(token, bucket);
    const name = resolveUniqueConversationName(baseName, existingTitles);
    const conversationPath = `${deploymentId}__${name}`;
    const folderId = `${bucket}`; // TODO: check

    const userMessage: MessageDto = {
      id: uuid,
      role: ChatMessageRole.User,
      content: firstMessage,
      timestamp: new Date(now).toISOString(),
      custom_content: customContent,
    };

    // TODO: add temperature and other conversation settings
    const conversation: Conversation = {
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
          body: conversation,
        },
      )) as { data?: unknown; error?: unknown };
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialError(error);
      }

      return { ...data, ...conversation } as Conversation;
    } catch (error) {
      this.logger.error('DIAL Core rejected saveConversation', error);
      return handleDialError(error);
    }
  }

  async getConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<Conversation> {
    const slashIndex = conversationPath.indexOf('/');
    const bucket =
      slashIndex === -1 ? sessionBucket : conversationPath.slice(0, slashIndex);
    const subPath =
      slashIndex === -1
        ? conversationPath
        : conversationPath.slice(slashIndex + 1);

    try {
      const { data, error } = (await this.client.getConversation(
        bucket,
        encodeDialResourcePath(subPath),
        { headers: getBearerAuthHeaders(token) },
      )) as { data?: unknown; error?: unknown };
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected getConversation', error);
        return handleDialError(error);
      }
      return data as Conversation;
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversation', error);
      return handleDialError(error);
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

    try {
      const { error } = (await this.client.moveResource({
        headers: getBearerAuthHeaders(token),
        body: { sourceUrl, destinationUrl, overwrite: false },
      })) as { error?: unknown };
      if (error != null) {
        this.logger.error('DIAL Core rejected moveResource (rename)', error);
        return handleDialError(error);
      }
    } catch (error) {
      this.logger.error('DIAL Core moveResource (rename) failed', error);
      return handleDialError(error);
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

    return { newPath: buildConversationUrl(bucket, renamedPath) };
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

    const filename = subPath.split('/').at(-1) ?? subPath;
    const sourceTitle = getConversationTitleFromName(filename);
    const existingTitles = await this.fetchAllUserTitles(token, sessionBucket);
    const uniqueTitle = resolveUniqueConversationName(
      prepareEntityName(sourceTitle),
      existingTitles,
    );
    const destFilename = buildRenamedConversationPath(filename, uniqueTitle);

    const sourceUrl = buildConversationUrl(
      sourceBucket,
      encodeDialResourcePath(subPath),
    );
    const destinationUrl = buildConversationUrl(
      sessionBucket,
      encodeURIComponent(destFilename),
    );

    try {
      const { error } = (await this.client.copyResource({
        headers: getBearerAuthHeaders(token),
        body: { sourceUrl, destinationUrl, overwrite: false },
      })) as { error?: unknown };
      if (error != null) {
        this.logger.error('DIAL Core rejected copyResource (duplicate)', error);
        return handleDialError(error);
      }
    } catch (error) {
      this.logger.error('DIAL Core copyResource (duplicate) failed', error);
      return handleDialError(error);
    }

    return { newPath: buildConversationUrl(sessionBucket, destFilename) };
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
              params: { query: buildQuery(userNextToken) },
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
        overrides: { sharedWithMe?: boolean; publishedWithMe?: boolean } = {},
      ): ConversationListItemDto[] =>
        items
          .filter((item) => item.nodeType !== 'FOLDER')
          .map((item) => {
            const id =
              item.url ?? `${item.parentPath ?? ''}/${item.name ?? ''}`;
            const decodedId = safeDecodeURIComponent(id);
            return {
              id,
              title: getConversationTitleFromName(item.name ?? ''),
              updatedAt: item.updatedAt ?? 0,
              sharedWithMe:
                overrides.sharedWithMe ?? item.sharedWithMe ?? false,
              publishedWithMe:
                overrides.publishedWithMe ?? item.publishedWithMe ?? false,
              isPinned: pinnedSet.has(decodedId),
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
              { publishedWithMe: true },
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
                };
              })
          : [];

      const items = [...userItems, ...publicItems, ...sharedItems].sort(
        (a, b) => b.updatedAt - a.updatedAt,
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
  ): Promise<ConversationMetadata> {
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
      return data as ConversationMetadata;
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversationMetadata', error);
      return handleDialError(error);
    }
  }

  async saveConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: Conversation,
  ): Promise<Conversation> {
    try {
      const { data, error } = (await this.client.saveConversation(
        bucket,
        encodeDialResourcePath(conversationPath),
        {
          headers: getBearerAuthHeaders(token),
          body: conversation,
        },
      )) as { data?: unknown; error?: unknown };
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialError(error);
      }
      return { ...data, ...conversation } as Conversation;
    } catch (error) {
      this.logger.error('DIAL Core rejected saveConversation', error);
      return handleDialError(error);
    }
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

  async streamCompletion(
    conversationPath: string,
    token: string,
    bucket: string,
    message: string,
    model: string,
    customContent?: MessageCustomContentDto,
  ): Promise<ReadableStream<Uint8Array>> {
    this.logger.debug(
      `streamCompletion start — model: ${model}, bucket: ${bucket}, path: ${conversationPath}`,
    );

    const conversation = await this.getConversation(
      conversationPath,
      token,
      bucket,
    );

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: MessageRole.User,
      content: message,
      timestamp: new Date().toISOString(),
      ...(customContent &&
        Object.keys(customContent).length > 0 && {
          custom_content: {
            attachments: customContent.attachments,
            form_value: customContent.form_value,
          },
        }),
    };

    // If the conversation already ends with a user turn (e.g. first-message auto-stream),
    // don't append again — the message is already in the persisted history.
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const messagesForCompletion =
      lastMessage?.role === MessageRole.User
        ? conversation.messages
        : [...conversation.messages, userMessage];

    const configuration =
      customContent?.configuration_value ??
      messagesForCompletion
        .filter((m) => m.custom_content?.configuration_value)
        .at(-1)?.custom_content?.configuration_value;
    const shouldHideCurrentConfigurationContent =
      customContent?.configuration_value !== undefined &&
      lastMessage?.role === MessageRole.User;

    const messages = messagesForCompletion
      .filter((m) => m.role !== MessageRole.Status)
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

    const requestBody = {
      messages,
      stream: true,
      ...(configuration ? { custom_fields: { configuration } } : {}),
    };

    this.logger.debug(
      `streamCompletion sending ${messages.length} message(s) to model: ${model}`,
    );

    try {
      const result = (await this.client.sendChatCompletionRequest(model, {
        body: requestBody,
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
        },
        params: { query: { 'api-version': this.dialApiVersion } },
        parseAs: 'stream',
      })) as { response: Response; error?: unknown };

      if (!result.response.ok || !result.response.body) {
        this.logger.error(
          `DIAL Core rejected streamCompletion — model: ${model}, status: ${result.response.status}`,
        );
        return handleDialError({ status: result.response.status });
      }
      return result.response.body;
    } catch (error) {
      this.logger.error('DIAL Core streamCompletion failed', error);
      return handleDialError(error);
    }
  }
}

const isHttpLikeError = (e: unknown): e is { status: number } =>
  typeof e === 'object' &&
  e != null &&
  'status' in e &&
  typeof (e as Record<string, unknown>).status === 'number';
