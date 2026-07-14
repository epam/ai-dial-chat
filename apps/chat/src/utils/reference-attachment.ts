import type { Annotation, MessageAttachment } from '@epam/ai-dial-chat-shared';
import { MIMEType } from '@epam/ai-dial-chat-shared';
import {
  groupAnnotationsBySource,
  type AnnotationGroup,
} from './group-annotations-by-source';

/**
 * A `MessageAttachment` is "reference-only" when it carries a `reference_url`
 * (e.g. a RAG/search-grounding chunk) but no directly downloadable `url`.
 */
export const isReferenceOnlyAttachment = (dto: MessageAttachment): boolean =>
  dto.url == null && dto.reference_url != null;

/** A reference URL pointing at a specific (optional) page of a PDF file. */
export interface PdfPageReference {
  /** The PDF file URL/id with the `#page=` fragment stripped. */
  baseUrl: string;
  /** 1-based page number, or `null` when the reference has no page fragment. */
  page: number | null;
}

const PDF_PAGE_REFERENCE_REGEX = /^(.*\.pdf)(?:#page=(\d+))?$/i;

/**
 * Parses a reference URL that points at a PDF file, optionally with a
 * `#page=N` fragment. Returns `null` when the URL does not target a PDF.
 */
export const parsePdfPageReference = (url: string): PdfPageReference | null => {
  const match = PDF_PAGE_REFERENCE_REGEX.exec(url);
  if (!match) return null;
  return {
    baseUrl: match[1],
    page: match[2] != null ? Number(match[2]) : null,
  };
};

/**
 * Maps reference-only attachments to synthetic {@link Annotation}s and groups
 * them by `reference_url`, reusing the same grouping core inline citations use,
 * so repeated chunks from the same source collapse into one group with a
 * Prev/Next switcher.
 */
export const getReferenceAttachmentGroups = (
  dtos: MessageAttachment[] | undefined,
): AnnotationGroup[] => {
  const annotations: Annotation[] = (dtos ?? [])
    .filter(isReferenceOnlyAttachment)
    .map((dto) => {
      const referenceUrl = dto.reference_url as string;
      const isPdfPage = parsePdfPageReference(referenceUrl) != null;
      return {
        body: {
          // omitted: dto.title already appears as the popup header (sourceName)
          quote: dto.data,
          source: {
            type: 'attachment' as const,
            attachment: {
              type: isPdfPage
                ? MIMEType.PDF
                : (dto.reference_type ?? dto.type ?? ''),
              url: referenceUrl,
              title: dto.title,
            },
          },
        },
      };
    });

  return groupAnnotationsBySource(annotations);
};
