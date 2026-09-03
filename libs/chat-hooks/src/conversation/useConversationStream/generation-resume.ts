import {
  MessageRole,
  type Conversation,
  type Message,
} from '@epam/ai-dial-chat-shared';

/**
 * True when the assistant message carries anything the backend's finalize save
 * would have written. Text alone is not enough to tell a finished response from
 * the start-state placeholder: an image-generation answer settles with an empty
 * `content` and only `custom_content.attachments`, and a stage-only or
 * form-only answer is just as text-free.
 */
const hasGeneratedPayload = (message: Message): boolean => {
  const customContent = message.custom_content;
  return (
    !!message.content ||
    message.responseId != null ||
    !!customContent?.attachments?.length ||
    !!customContent?.stages?.length ||
    !!customContent?.annotations?.length ||
    !!customContent?.form_schema ||
    customContent?.state != null
  );
};

/**
 * True when the conversation's last message is an unresolved assistant
 * placeholder: the backend only persists a conversation at generation start
 * (empty placeholder) and at generation end (final content, or a partial
 * flagged `streamErrorMessage`/`wasStoppedByUser`), so this shape means a
 * generation was still active elsewhere when the conversation was loaded.
 */
export const isAwaitingGenerationResume = (
  conversation: Conversation,
): boolean => {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  return (
    !!lastMessage &&
    lastMessage.role === MessageRole.Assistant &&
    !hasGeneratedPayload(lastMessage) &&
    lastMessage.streamErrorMessage == null &&
    !lastMessage.wasStoppedByUser
  );
};
