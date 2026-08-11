import type { Conversation } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import type { ConversationResponseDto } from '@epam/ai-dial-chat-api-client';

/** True when the first user/assistant exchange is complete and LLM naming may still run. */
export const shouldWatchForDisplayNameUpdate = (
  conversation: Conversation,
): boolean => {
  const nonStatusMessages = conversation.messages.filter(
    (message) => message.role !== MessageRole.Status,
  );
  if (nonStatusMessages.length < 2) return false;

  const dto = conversation as ConversationResponseDto;
  return dto.llmNamingDone !== true;
};
