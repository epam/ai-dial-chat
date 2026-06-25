import type { Annotation, Message } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { normalizeRawAnnotations } from '../../utils/annotation';

/**
 * Returns the resolved annotation list for an assistant message.
 *
 * Returns an empty array while streaming is in progress.
 *
 * Prefers `custom_content.annotations` (internal format) when present.
 * Falls back to `custom_fields.annotations` (raw API wire format) and
 * normalises those using the message's `custom_content.attachments` to
 * resolve attachment URLs and convert `pdf_region` selectors to `pdf_bbox`.
 */
export const useAnnotations = (
  message: Message,
  isStreaming: boolean,
): Annotation[] => {
  const contentAnnotations = message.custom_content?.annotations;
  const attachments = message.custom_content?.attachments;
  const customFields = message['custom_fields'];

  return useMemo(() => {
    if (isStreaming) return [];

    if (contentAnnotations?.length) {
      return contentAnnotations.filter(
        (a): a is Annotation =>
          a != null && a.body?.source?.attachment?.url != null,
      );
    }

    if (typeof customFields !== 'object' || customFields === null) return [];
    const raw = (customFields as Record<string, unknown>)['annotations'];
    if (!Array.isArray(raw) || raw.length === 0) return [];

    return normalizeRawAnnotations(raw, attachments ?? []);
  }, [isStreaming, contentAnnotations, attachments, customFields]);
};
