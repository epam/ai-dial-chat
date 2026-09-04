import type { Conversation, Message } from '@epam/ai-dial-chat-shared';

/**
 * A generation's assistant message accumulated while its conversation isn't
 * the displayed one (a background stream, or a resume attach), keyed by
 * conversation path so it can be restored once that conversation is shown
 * again.
 */
export interface BufferedGeneration {
  generationId: string;
  messageIndex: number;
  message: Message;
}

const mergeBufferedMessage = (
  current: Message,
  buffered: Message,
): Message => ({
  ...current,
  ...buffered,
  ...((current.custom_content || buffered.custom_content) && {
    custom_content: {
      ...current.custom_content,
      ...buffered.custom_content,
    },
  }),
});

/** Restores `buffered.message` into `conversation` at `buffered.messageIndex`, merging into whatever message is already there. */
export const restoreBufferedMessage = (
  conversation: Conversation,
  buffered: BufferedGeneration,
): Conversation => {
  if (buffered.messageIndex > conversation.messages.length) {
    return conversation;
  }

  const messages = [...conversation.messages];
  if (buffered.messageIndex === messages.length) {
    messages.push(buffered.message);
  } else {
    messages[buffered.messageIndex] = mergeBufferedMessage(
      messages[buffered.messageIndex],
      buffered.message,
    );
  }
  return { ...conversation, messages };
};
