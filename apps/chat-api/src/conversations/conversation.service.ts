import { Conversation, MessageRole, Message } from '@epam/chat-shared';
import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { handleDialError } from '../common/utils/dial-error';

@Injectable()
export class ConversationService extends AppService {
  protected logger = new Logger(ConversationService.name);

  async createConversation(
    firstMessage: string,
    accessToken: string,
    bucket: string,
  ): Promise<Conversation> {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    const name = firstMessage.slice(0, 160);
    const conversationPath = `${uuid}__${name}`;
    const folderId = `conversations/${bucket}`;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: MessageRole.User,
      content: firstMessage,
      timestamp: new Date(now).toISOString(),
    };

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
          headers: { Authorization: `Bearer ${accessToken}` },
          body: conversation,
        },
      )) as { data?: unknown; error?: unknown };
      if (error !== undefined || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialError(error);
      }
      return conversation;
    } catch (error) {
      return handleDialError(error);
    }
  }
}
