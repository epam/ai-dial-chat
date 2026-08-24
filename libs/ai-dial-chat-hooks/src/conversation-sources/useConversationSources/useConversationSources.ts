import type {
  AttachmentDisplayResolvers,
  DisplayAttachment,
  Message,
} from '@epam/ai-dial-chat-shared';
import {
  messageAttachmentToDisplayAttachment,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import {
  isReferenceOnlyAttachment,
  resolveMessageAnnotations,
} from '@epam/ai-dial-quotations';
import type { QuotationSource } from '@epam/ai-dial-source-panel';
import { useMemo } from 'react';

/*
 * Stable empty-object reference so omitting `resolvers` doesn't create a new
 * object on every render, which would defeat the `useMemo` below.
 */
const EMPTY_RESOLVERS: AttachmentDisplayResolvers = {};

/** Return value of {@link useConversationSources}. */
export interface UseConversationSourcesResult {
  /** Deduplicated attachments the user uploaded across the conversation. */
  uploaded: DisplayAttachment[];
  /** Deduplicated attachments the assistant generated across the conversation. */
  generated: DisplayAttachment[];
  /** Quotation sources referenced by assistant messages, deduplicated by URL. */
  sources: QuotationSource[];
}

/**
 * Derives uploaded (user), generated (assistant) attachment lists, and
 * quotation sources from a conversation's message array. All lists are
 * memoised on the `messages` reference. `resolvers` are forwarded to
 * `@epam/ai-dial-chat-shared`'s attachment mapper for preview/play URL
 * resolution — pass an empty object when the host has no such resolution.
 */
export const useConversationSources = (
  messages: Message[],
  resolvers: AttachmentDisplayResolvers = EMPTY_RESOLVERS,
): UseConversationSourcesResult => {
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
        for (const dto of dtos ?? []) {
          const att = messageAttachmentToDisplayAttachment(dto, resolvers);
          if (seenUploadedIds.has(att.id)) continue;
          seenUploadedIds.add(att.id);
          uploaded.push(att);
        }
      } else if (msg.role === MessageRole.Assistant) {
        const regularDtos = dtos?.filter(
          (dto) => !isReferenceOnlyAttachment(dto),
        );
        for (const dto of regularDtos ?? []) {
          const att = messageAttachmentToDisplayAttachment(dto, resolvers);
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
  }, [messages, resolvers]);
};
