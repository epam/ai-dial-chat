import {
  Conversation,
  ConversationMetadata,
  Message,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { Injectable, Logger } from '@nestjs/common';
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
import { MessageCustomContentDto } from './dto/message-custom-content.dto';
import { RenameConversationResponseDto } from './dto/rename-conversation.dto';
import type {
  MetadataItem,
  MetadataResult,
  SharedResourcesResult,
} from './types/conversation.types';
import {
  buildRenamedConversationPath,
  decodeNextToken,
  encodeCompoundToken,
  encodeDialResourcePath,
  getConversationName,
  getConversationTitleFromName,
  prepareEntityName,
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
    const conversationId = `conversations/${bucket}/${conversationPath}`;
    void this.pinConversation(conversationId, false, token, bucket).catch(
      (err) => this.logger.error('Failed to clean up pin on delete', err),
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

    const sourceUrl = `conversations/${bucket}/${encodeDialResourcePath(conversationPath)}`;
    const destinationUrl = `conversations/${bucket}/${encodeDialResourcePath(renamedPath)}`;

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

    return { newPath: `conversations/${bucket}/${renamedPath}` };
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

      const pinnedSet = new Set(pinnedIds);

      const mapItems = (
        items: MetadataItem[],
        overrides: { sharedWithMe?: boolean; publishedWithMe?: boolean } = {},
      ): ConversationListItemDto[] =>
        items
          .filter((item) => item.nodeType !== 'FOLDER')
          .map((item) => {
            const id =
              item.url ?? `${item.parentPath ?? ''}/${item.name ?? ''}`;
            return {
              id,
              title: getConversationTitleFromName(item.name ?? ''),
              updatedAt: item.updatedAt ?? 0,
              sharedWithMe:
                overrides.sharedWithMe ?? item.sharedWithMe ?? false,
              publishedWithMe:
                overrides.publishedWithMe ?? item.publishedWithMe ?? false,
              isPinned: pinnedSet.has(id),
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
                return {
                  id,
                  title: getConversationTitleFromName(r.name ?? ''),
                  updatedAt: 0,
                  sharedWithMe: true,
                  publishedWithMe: false,
                  isPinned: pinnedSet.has(id),
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
