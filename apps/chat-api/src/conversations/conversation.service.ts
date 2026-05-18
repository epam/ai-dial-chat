import { Conversation, MessageRole, Message } from '@epam/chat-shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import { getConversationName } from './conversation.utils';

@Injectable()
export class ConversationService extends AppService {
  protected logger = new Logger(ConversationService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async createConversation(
    firstMessage: string,
    token: string,
    bucket: string,
  ): Promise<Conversation> {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    const name = getConversationName(firstMessage);
    const conversationPath = `${uuid}__${name}`;
    const folderId = `conversations/${bucket}`; // TODO: check

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: MessageRole.User,
      content: firstMessage,
      timestamp: new Date(now).toISOString(),
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

      console.log('Conversation saved successfully', data);
      return conversation;
    } catch (error) {
      this.logger.error('DIAL Core rejected saveConversation', error);
      return handleDialError(error);
    }
  }
}
