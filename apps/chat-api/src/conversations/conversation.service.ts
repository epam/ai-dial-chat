import {
  Conversation,
  ConversationMetadata,
  MessageRole,
  Message,
  type ApiAttachment,
} from '@epam/ai-dial-chat-shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import { EnvironmentVariables } from '../config/environment.config';
import { getConversationName } from './conversation.utils';

@Injectable()
export class ConversationService extends AppService {
  protected logger = new Logger(ConversationService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    super(configService);
  }

  async createConversation(
    firstMessage: string,
    token: string,
    bucket: string,
    attachments?: ApiAttachment[],
  ): Promise<Conversation> {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    const name = getConversationName(firstMessage);
    const conversationPath = `${uuid}__${name}`;
    const folderId = `${bucket}`; // TODO: check

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: MessageRole.User,
      content: firstMessage,
      timestamp: new Date(now).toISOString(),
      ...(attachments?.length ? { custom_content: { attachments } } : {}),
    };

    // TODO: remove hardcoded - add model info
    // TODO: add temperature and other conversation settings
    const conversation: Conversation = {
      id: `${folderId}/${conversationPath}`,
      folderId,
      name,
      model: { id: 'anthropic.claude-v3-sonnet' },
      prompt: '',
      temperature: 1,
      messages: [userMessage],
      lastActivityDate: now,
      updatedAt: now,
      selectedAddons: [],
      assistantModelId: 'anthropic.claude-v3-sonnet',
    };

    try {
      const { data, error } = (await this.client.saveConversation(
        bucket,
        conversationPath,
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
        conversationPath,
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
        conversationPath,
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

  async getConversationMetadata(
    conversationPath: string,
    token: string,
    bucket: string,
    permissions?: boolean,
  ): Promise<ConversationMetadata> {
    try {
      const { data, error } = (await this.client.getConversationMetadata(
        bucket,
        conversationPath,
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
        conversationPath,
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
    attachments?: ApiAttachment[],
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
      ...(attachments?.length ? { custom_content: { attachments } } : {}),
    };

    // If the conversation already ends with a user turn (e.g. first-message auto-stream),
    // don't append again — the message is already in the persisted history.
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const messagesForCompletion =
      lastMessage?.role === MessageRole.User
        ? conversation.messages
        : [...conversation.messages, userMessage];

    const messages = messagesForCompletion.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.custom_content?.attachments?.length
        ? { custom_content: { attachments: m.custom_content.attachments } }
        : {}),
    }));

    try {
      const result = (await this.client.sendChatCompletionRequest(model, {
        body: { messages, stream: true },
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
        },
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
