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
import {
  getConversationName,
  getConversationTitleFromName,
} from './conversation.utils';
import {
  ConversationListItemDto,
  ConversationListResponseDto,
} from './dto/conversation-list.dto';
import { MessageCustomContentDto } from './dto/message-custom-content.dto';

const getValidAttachments = (customContent?: Message['custom_content']) =>
  (customContent?.attachments ?? []).filter((attachment) =>
    Boolean(attachment.data || attachment.url),
  );

// TODO: Remove this once the DIAL SDK encodes resource path segments internally.
const encodeDialResourcePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

@Injectable()
export class ConversationService extends AppService {
  protected override logger = new Logger(ConversationService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    super(configService);
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
    const name = getConversationName(firstMessage);
    const conversationPath = `${deploymentId}__${name}__${uuid}`;
    const folderId = `${bucket}`; // TODO: check

    const userMessage: MessageDto = {
      id: crypto.randomUUID(),
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
      if (error !== undefined || !data) {
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
    bucket: string,
  ): Promise<Conversation> {
    try {
      const { data, error } = (await this.client.getConversation(
        bucket,
        encodeDialResourcePath(conversationPath),
        { headers: getBearerAuthHeaders(token) },
      )) as { data?: unknown; error?: unknown };
      if (error !== undefined || !data) {
        this.logger.error('DIAL Core rejected getConversation', error);
        return handleDialError(error);
      }
      return data as Conversation;
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversation', error);
      return handleDialError(error);
    }
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
      if (error !== undefined) {
        this.logger.error('DIAL Core rejected deleteConversation', error);
        handleDialError(error);
      }
    } catch (error) {
      this.logger.error('DIAL Core rejected deleteConversation', error);
      handleDialError(error);
    }
  }

  async listConversations(
    token: string,
    bucket: string,
    limit = 20,
    nextToken?: string,
    path?: string,
  ): Promise<ConversationListResponseDto> {
    try {
      const { data, error } = (await this.client.getConversationMetadata(
        bucket,
        encodeDialResourcePath(path ?? ''),
        {
          headers: getBearerAuthHeaders(token),
          query: {
            recursive: true,
            limit,
            ...(nextToken ? { token: nextToken } : {}),
          },
        },
      )) as {
        data?: {
          items?: {
            name?: string;
            url?: string;
            parentPath?: string;
            updatedAt?: number;
            nodeType?: string;
          }[];
          nextToken?: string;
        };
        error?: unknown;
      };

      if (error !== undefined || !data) {
        this.logger.error('DIAL Core rejected listConversations', error);
        return handleDialError(error);
      }

      const items: ConversationListItemDto[] = (data.items ?? [])
        .filter((item) => item.nodeType !== 'FOLDER')
        .map((item) => ({
          id: item.url ?? `${item.parentPath ?? ''}/${item.name ?? ''}`,
          title: getConversationTitleFromName(item.name ?? ''),
          updatedAt: item.updatedAt ?? 0,
        }));

      return { items, nextToken: data.nextToken };
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
          query: permissions !== undefined ? { permissions } : undefined,
        },
      )) as { data?: unknown; error?: unknown };
      if (error !== undefined || !data) {
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
      if (error !== undefined || !data) {
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

    // configuration_value is sent as top-level custom_fields.configuration,
    // not inside the messages array.
    const configuration = customContent?.configuration_value;

    const messages = messagesForCompletion
      .filter((m) => m.role !== MessageRole.Status)
      .map((m) => {
        const validAttachments = getValidAttachments(m.custom_content);
        const content = Object.fromEntries(
          Object.entries({
            ...m.custom_content,
            attachments: validAttachments.length ? validAttachments : undefined,
            configuration_value: undefined, // configuration_value is sent as top-level custom_fields.configuration, not inside messages[].custom_content
          }).filter(([, value]) => value != null),
        );
        return {
          role: m.role,
          content: m.content,
          ...(Object.keys(content).length > 0
            ? { custom_content: content }
            : {}),
        };
      });

    try {
      const result = (await this.client.sendChatCompletionRequest(model, {
        body: {
          messages,
          stream: true,
          ...(configuration ? { custom_fields: { configuration } } : {}),
        },
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
        },
        params: { query: { 'api-version': this.dialApiVersion } },
        parseAs: 'stream',
      })) as { response: Response; error?: unknown };

      if (!result.response.ok || !result.response.body) {
        this.logger.error(
          'DIAL Core rejected streamCompletion',
          result.response.status,
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
