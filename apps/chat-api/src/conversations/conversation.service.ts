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
    console.log('Creating ', `${this.configService.get('DIAL_CORE_URL', { infer: true }) as string}/v1/conversations/${conversation.id}`);

    try {
      const response = await fetch(
        `${this.configService.get('DIAL_CORE_URL', { infer: true }) as string}/v1/conversations/${bucket}/${conversation.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ conversation }),
        },
      );

      console.log('Received response:', response);

      if (!response.ok) {
        this.logger.warn(
          `Failed to create conversation: ${response.status} ${response.statusText}`,
        );
        throw new Error(
          `Failed to create conversation: ${response.statusText}`,
        );
      }

      const data = await response.json();
      this.logger.debug('Successfully created conversation');
      return data as Conversation;
    } catch (error) {
      console.log('Error creating conversation:', error);
      return handleDialError(error);
    }
  }
}
