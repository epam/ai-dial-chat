import type { DisplayAttachment, Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import type { QuotationSource } from '@epam/ai-dial-source-panel';
import { useMemo } from 'react';
import { attachmentDtosToDisplayAttachments } from '../../utils/attachment-dto-to-display';

/**
 * Derives uploaded (user), generated (assistant) attachment lists, and quotation sources
 * from a conversation's message array. All lists are memoised on the `messages` reference.
 */
export const useConversationSources = (
  messages: Message[],
): {
  uploaded: DisplayAttachment[];
  generated: DisplayAttachment[];
  sources: QuotationSource[];
} => {
  return useMemo(() => {
    const uploaded: DisplayAttachment[] = [];
    const generated: DisplayAttachment[] = [];
    const sources: QuotationSource[] = [];
    const seenUrls = new Set<string>();

    for (const msg of messages) {
      const attachments = attachmentDtosToDisplayAttachments(
        msg.custom_content?.attachments,
      );
      if (msg.role === MessageRole.User) {
        uploaded.push(...attachments);
      } else if (msg.role === MessageRole.Assistant) {
        generated.push(...attachments);

        for (const annotation of msg.custom_content?.annotations ?? []) {
          const att = annotation?.body?.source?.attachment;
          const url = att?.url;
          if (!url || seenUrls.has(url)) continue;
          seenUrls.add(url);
          sources.push({
            url,
            title: att?.title ?? url.split('/').pop() ?? url,
            contentType: att?.type ?? '',
            quote: annotation.body?.quote,
          });
        }
      }
    }

    return { uploaded, generated, sources };
  }, [messages]);
};
