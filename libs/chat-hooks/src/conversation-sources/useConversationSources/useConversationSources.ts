import type {
  Annotation,
  AttachmentDisplayResolvers,
  DisplayAttachment,
  Message,
} from '@epam/ai-dial-chat-shared';
import {
  messageAttachmentToDisplayAttachment,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import {
  getAnnotationPdfPage,
  isReferenceOnlyAttachment,
  parsePdfPageReference,
  resolveMessageAnnotations,
} from '@epam/ai-dial-quotations';
import type { QuotationSource } from '@epam/ai-dial-source-panel';
import { useMemo } from 'react';

/*
 * Stable empty-object reference so omitting `resolvers` doesn't create a new
 * object on every render, which would defeat the `useMemo` below.
 */
const EMPTY_RESOLVERS: AttachmentDisplayResolvers = {};

/*
 * Qualifies a citation's `.pdf` URL with the cited page (`#page=N`) — the
 * same form reference-only sources already carry — so each cited page is its
 * own source and opens at that page. URLs that are not PDFs, already carry a
 * fragment, or whose annotation has no PDF selector are returned unchanged.
 */
const toAnnotationSourceUrl = (annotation: Annotation, url: string): string => {
  const page = getAnnotationPdfPage(annotation);
  if (page == null) return url;
  const reference = parsePdfPageReference(url);
  if (reference == null || reference.page != null) return url;
  return `${url}#page=${page}`;
};

/** Return value of {@link useConversationSources}. */
export interface UseConversationSourcesResult {
  /** Deduplicated attachments the user uploaded across the conversation. */
  uploaded: DisplayAttachment[];
  /** Deduplicated attachments the assistant generated across the conversation. */
  generated: DisplayAttachment[];
  /** Quotation sources referenced by assistant messages, deduplicated by URL; PDF sources are qualified with `#page=N`. */
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
          const fileUrl = att?.url;
          if (!fileUrl) continue;
          const url = toAnnotationSourceUrl(annotation, fileUrl);
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);
          sources.push({
            url,
            title: att?.title ?? fileUrl.split('/').pop() ?? fileUrl,
            contentType: att?.type ?? '',
            quote: annotation.body?.quote,
          });
        }
      }
    }

    return { uploaded, generated, sources };
  }, [messages, resolvers]);
};
