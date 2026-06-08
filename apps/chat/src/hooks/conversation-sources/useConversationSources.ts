import type { DisplayAttachment, Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { attachmentDtosToDisplayAttachments } from '../../utils/attachment-dto-to-display';

/**
 * Derives uploaded (user) and generated (assistant) attachment lists from a conversation's
 * message array. Both lists are memoised on the `messages` reference — no extra re-derivation
 * occurs unless the array itself changes.
 */
export const useConversationSources = (
  messages: Message[],
): { uploaded: DisplayAttachment[]; generated: DisplayAttachment[] } => {
  return useMemo(() => {
    const uploaded: DisplayAttachment[] = [];
    const generated: DisplayAttachment[] = [];

    for (const msg of messages) {
      const attachments = attachmentDtosToDisplayAttachments(
        msg.custom_content?.attachments,
      );
      if (msg.role === MessageRole.User) {
        uploaded.push(...attachments);
      } else if (msg.role === MessageRole.Assistant) {
        generated.push(...attachments);
      }
    }

    return { uploaded, generated };
  }, [messages]);
};
