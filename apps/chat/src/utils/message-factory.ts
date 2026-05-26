import { Message, MessageRole } from '@epam/ai-dial-chat-shared';
import type { AttachmentDto } from '@epam/chat-api-client';

interface MessagePair {
  userMessage: Message;
  assistantMessage: Message;
  assistantMessageId: string;
}

export const createMessagePair = (
  content: string,
  attachments?: AttachmentDto[],
  configurationValue?: Record<string, unknown>,
): MessagePair => {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const assistantMessageId = `stream_${now}`;

  const customContent = {
    ...(attachments?.length ? { attachments } : {}),
    ...(configurationValue ? { configuration_value: configurationValue } : {}),
  };

  return {
    userMessage: {
      id: `msg_${now}`,
      role: MessageRole.User,
      content,
      timestamp,
      ...(Object.keys(customContent).length
        ? { custom_content: customContent }
        : {}),
    },
    assistantMessage: {
      id: assistantMessageId,
      role: MessageRole.Assistant,
      content: '',
      timestamp,
    },
    assistantMessageId,
  };
};
