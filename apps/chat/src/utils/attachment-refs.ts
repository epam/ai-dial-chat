import type { Conversation } from '@epam/ai-dial-chat-shared';
import { isDialFileId } from './dial-file';

/** A unique DIAL file reference found in a conversation's messages. */
export interface AttachmentRef {
  fileId: string;
}

/**
 * Collects unique attachment references across all messages. The same file
 * can be attached to more than one message (e.g. re-shared in a later
 * turn) — dedupe by `fileId` so it is only processed once.
 */
export const collectAttachmentRefs = (
  conversation: Conversation,
): AttachmentRef[] => {
  const fileIds = new Set<string>();
  for (const message of conversation.messages) {
    for (const attachment of message.custom_content?.attachments ?? []) {
      const fileId = attachment.url ?? attachment.reference_url;
      if (fileId != null && isDialFileId(fileId)) {
        fileIds.add(fileId);
      }
    }
  }
  return Array.from(fileIds, (fileId) => ({ fileId }));
};
