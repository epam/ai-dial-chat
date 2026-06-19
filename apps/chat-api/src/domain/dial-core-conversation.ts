import type { MessageCustomContentDto } from '../conversations/dto/message-custom-content.dto';
import type { ConversationResponseDto } from '../openapi/openapi-response.dto';

/** Message roles persisted in DIAL Core conversation payloads (includes client-only status events). */
export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  Status = 'status',
}

/** Discriminator values for in-conversation status event messages. */
export enum StatusEvent {
  ModelChanged = 'model_changed',
}

/** Conversation message shape when reading from or writing to DIAL Core (may include status events). */
export interface DialCoreMessage {
  role: MessageRole | `${MessageRole}`;
  content: string;
  timestamp: string;
  custom_content?: MessageCustomContentDto & Record<string, unknown>;
  [key: string]: unknown;
}

/** Full conversation document exchanged with DIAL Core. */
export type DialCoreConversation = Omit<ConversationResponseDto, 'messages'> & {
  messages: DialCoreMessage[];
};
