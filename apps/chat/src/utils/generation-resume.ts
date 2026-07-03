import type { Conversation } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';

/**
 * True when the conversation's last message is an unresolved assistant
 * placeholder: the backend only persists a conversation at generation start
 * (empty placeholder) and at generation end (final content, or a partial
 * flagged `hasStreamError`/`wasStoppedByUser`), so this shape means a
 * generation was still active elsewhere when the conversation was loaded.
 */
export const isAwaitingGenerationResume = (
  conversation: Conversation,
): boolean => {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  return (
    !!lastMessage &&
    lastMessage.role === MessageRole.Assistant &&
    !lastMessage.content &&
    !lastMessage.hasStreamError &&
    !lastMessage.wasStoppedByUser
  );
};
