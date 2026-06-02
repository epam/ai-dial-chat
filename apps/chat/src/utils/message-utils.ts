import { Message, MessageRole } from '@epam/ai-dial-chat-shared';

/**
 * Returns `true` when `message` is the actively-streaming assistant response.
 * Only the last message in the list can be streaming, and only while
 * `isAssistantTyping` is `true`.
 */
export const isMessageStreaming = (
  message: Message,
  messageIndex: number,
  totalMessages: number,
  isAssistantTyping: boolean,
): boolean =>
  isAssistantTyping &&
  messageIndex === totalMessages - 1 &&
  message.role === MessageRole.Assistant;

/**
 * Returns `true` when `message` is an assistant message that carries at least
 * one accumulated stage — i.e. a `StagesPanel` should be rendered for it.
 */
export const messageHasStages = (message: Message): boolean =>
  message.role === MessageRole.Assistant &&
  (message.custom_content?.stages?.length ?? 0) > 0;
