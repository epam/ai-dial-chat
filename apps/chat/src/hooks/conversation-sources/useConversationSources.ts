import type { DisplayAttachment, Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import {
  isReferenceOnlyAttachment,
  resolveMessageAnnotations,
} from '@epam/ai-dial-quotations';
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
    const seenUploadedIds = new Set<string | undefined>();
    const seenGeneratedIds = new Set<string | undefined>();

    for (const msg of messages) {
      const dtos = msg.custom_content?.attachments;
      if (msg.role === MessageRole.User) {
        for (const att of attachmentDtosToDisplayAttachments(dtos)) {
          if (seenUploadedIds.has(att.id)) continue;
          seenUploadedIds.add(att.id);
          uploaded.push(att);
        }
      } else if (msg.role === MessageRole.Assistant) {
        const regularDtos = dtos?.filter(
          (dto) => !isReferenceOnlyAttachment(dto),
        );
        for (const att of attachmentDtosToDisplayAttachments(regularDtos)) {
          if (seenGeneratedIds.has(att.id)) continue;
          seenGeneratedIds.add(att.id);
          generated.push(att);
        }

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
