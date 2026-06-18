import type { Annotation, Message } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';

/**
 * Returns the resolved annotation list for an assistant message.
 *
 * Returns an empty array while streaming is in progress; once the stream
 * completes the final message contains the fully assembled annotations and
 * they are returned filtered to those with a `body.source.attachment.url`.
 * Annotations without a source URL have no citation marker and are excluded.
 */
export const useAnnotations = (
  message: Message,
  isStreaming: boolean,
): Annotation[] => {
  const annotations = message.custom_content?.annotations;

  return useMemo(() => {
    if (isStreaming) return [];

    const source = annotations ?? [];
    return source.filter(
      (a): a is Annotation =>
        a != null && a.body?.source?.attachment?.url != null,
    );
  }, [isStreaming, annotations]);
};
