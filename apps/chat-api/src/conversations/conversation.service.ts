import { Conversation, MessageRole, Message } from '@epam/chat-shared';
import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';

@Injectable()
export class ConversationService extends AppService {
  protected logger = new Logger(ConversationService.name);

  async createConversation(
    firstMessage: string,
    token: string,
    bucket: string,
  ): Promise<Conversation> {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    const name = firstMessage.slice(0, 160); // TODO: implement better name generation based on the message content
    const conversationPath = `${uuid}__${name}`;
    const folderId = `conversations/${bucket}`;

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
