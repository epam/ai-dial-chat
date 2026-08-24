import {
  type Message,
  type MessageCustomContent,
  MessageRole,
} from '@epam/ai-dial-chat-shared';

/** A newly-created user message paired with its empty assistant placeholder. */
export interface MessagePair {
  userMessage: Message;
  assistantMessage: Message;
}

/** Builds a user message and its empty assistant placeholder, both timestamped `now`. */
export const createMessagePair = (
  content: string,
  customContent?: MessageCustomContent,
  deploymentId?: string | null,
): MessagePair => {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();

  return {
    userMessage: {
      role: MessageRole.User,
      content,
      timestamp,
      ...(customContent && Object.keys(customContent).length
        ? { custom_content: customContent }
        : {}),
    },
    assistantMessage: {
      role: MessageRole.Assistant,
      content: '',
      timestamp,
      ...(deploymentId ? { deploymentId } : {}),
    },
  };
};
