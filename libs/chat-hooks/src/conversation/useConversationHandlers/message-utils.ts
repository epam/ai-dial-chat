import type {
  Attachment,
  DisplayAttachment,
  Message,
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
