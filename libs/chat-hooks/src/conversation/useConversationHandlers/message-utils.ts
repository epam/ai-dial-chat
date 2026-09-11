import {
  type Attachment,
  type DisplayAttachment,
  type Message,
  MessageRole,
} from '@epam/ai-dial-chat-shared';

/** Whether at least one tool toggle in `value` is active. */
export const hasActiveToolConfig = (
  value: Record<string, boolean> | undefined,
): boolean => value != null && Object.keys(value).length > 0;

/**
 * Returns `true` when the edited text or attachment list differs from the
 * original message, meaning a regeneration is needed.
 *
 * @param originalMessage - The unmodified message stored in the conversation.
 * @param newText - The text the user submitted from the edit area.
 * @param keptDisplayAttachments - Attachments the user kept (not removed).
 * @param newAttachments - Brand-new attachments the user added during editing.
 */
export const isMessageChanged = (
  originalMessage: Message,
  newText: string,
  keptDisplayAttachments: DisplayAttachment[],
  newAttachments: Attachment[],
): boolean => {
  if (newText !== originalMessage.content) return true;
  if (newAttachments.length > 0) return true;
  const originalAttachmentCount =
    originalMessage.custom_content?.attachments?.length ?? 0;
  return keptDisplayAttachments.length !== originalAttachmentCount;
};

/**
 * Whether the assistant answer that follows an edited user message is missing
 * or incomplete: no message at all, a non-assistant message, an answer the
 * user stopped, or one that ended with a stream error.
 */
export const isAnswerIncomplete = (answer: Message | undefined): boolean =>
  answer == null ||
  answer.role !== MessageRole.Assistant ||
  !!answer.wasStoppedByUser ||
  answer.streamErrorMessage != null;

/**
 * Whether submitting an edit has to re-run the generation.
 *
 * True whenever the message itself changed, and also when it is unchanged but
 * its answer never completed — after stopping a generation the user submits
 * the same message precisely to get a full answer, so treating that as "no
 * change" would leave the conversation stuck with the partial one.
 */
export const shouldRerunGenerationOnEdit = (
  messages: Message[],
  messageIndex: number,
  newText: string,
  keptDisplayAttachments: DisplayAttachment[],
  newAttachments: Attachment[],
): boolean => {
  const originalMessage = messages[messageIndex];
  if (!originalMessage) return false;

  return (
    isMessageChanged(
      originalMessage,
      newText,
      keptDisplayAttachments,
      newAttachments,
    ) || isAnswerIncomplete(messages[messageIndex + 1])
  );
};
