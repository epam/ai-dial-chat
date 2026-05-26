import {
  type ApiAttachment,
  Message,
  MessageRole,
} from '@epam/ai-dial-chat-shared';

interface MessagePair {
  userMessage: Message;
  assistantMessage: Message;
  assistantMessageId: string;
}

export const createMessagePair = ({
  content,
  attachments,
}: {
  content: string;
  attachments?: ApiAttachment[];
}): MessagePair => {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const assistantMessageId = `stream_${now}`;

  return {
    userMessage: {
      id: `msg_${now}`,
      role: MessageRole.User,
      content,
      timestamp,
      ...(attachments?.length ? { custom_content: { attachments } } : {}),
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
