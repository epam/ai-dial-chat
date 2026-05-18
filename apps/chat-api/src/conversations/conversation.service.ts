import { Conversation, MessageRole, Message } from '@epam/chat-shared';
import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { handleDialError } from '../common/utils/dial-error';

@Injectable()
export class ConversationService extends AppService {
  protected logger = new Logger(ConversationService.name);

  async createConversation(firstMessage: string, accessToken: string, bucket: string): Promise<Conversation> {
    const now = new Date().toISOString();
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: MessageRole.User,
      content: firstMessage,
      timestamp: now,
    };
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      messages: [userMessage],
      createdAt: now,
    };
    try {
      const data = await this.client.saveConversation(bucket, conversation.id, {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(conversation),
      });
      this.logger.debug('Successfully created conversation');
      return data as Conversation;
    } catch (error) {
      return handleDialError(error);
    }
  }
}
