import type { Annotation, Message } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { resolveMessageAnnotations } from '../../utils/annotation';

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
  return useMemo(() => {
    if (isStreaming) return [];
    return resolveMessageAnnotations(message);
  }, [isStreaming, message]);
};
