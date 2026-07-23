import type { DisplayAttachment, Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import type { QuotationSource } from '@epam/ai-dial-source-panel';
import { useMemo } from 'react';
import { resolveMessageAnnotations } from '../../utils/annotation';
import { attachmentDtosToDisplayAttachments } from '../../utils/attachment-dto-to-display';
import { isReferenceOnlyAttachment } from '../../utils/reference-attachment';

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
      const dtos = msg.custom_content?.attachments;
      if (msg.role === MessageRole.User) {
        uploaded.push(...attachmentDtosToDisplayAttachments(dtos));
      } else if (msg.role === MessageRole.Assistant) {
        const regularDtos = dtos?.filter(
          (dto) => !isReferenceOnlyAttachment(dto),
        );
        generated.push(...attachmentDtosToDisplayAttachments(regularDtos));

        for (const dto of dtos ?? []) {
          if (!isReferenceOnlyAttachment(dto)) continue;
          const url = dto.reference_url as string;
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);
          sources.push({
            url,
            title: dto.title ?? url,
            contentType: dto.reference_type ?? dto.type ?? '',
            quote: dto.data,
          });
        }

        for (const annotation of resolveMessageAnnotations(msg)) {
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
