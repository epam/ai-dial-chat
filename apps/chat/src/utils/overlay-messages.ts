import type { OverlayChatMessage } from '@epam/ai-dial-chat-overlay';
import type { Message } from '@epam/ai-dial-chat-shared';

export const toOverlayMessages = (messages: Message[]): OverlayChatMessage[] =>
  messages.map((message, index) => ({
    id: index.toString(),
    role: message.role,
    content: message.content,
  }));
