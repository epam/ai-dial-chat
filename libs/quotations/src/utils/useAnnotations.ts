import type { Annotation, Message } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { resolveMessageAnnotations } from './annotation';

/**
 * Returns the resolved annotation list for an assistant message. While
 * streaming, only `html_tag`-selector annotations are returned; every other
 * selector family stays hidden until the message finishes.
 */
export const useAnnotations = (
  message: Message,
  isStreaming: boolean,
): Annotation[] => {
  return useMemo(() => {
    const resolved = resolveMessageAnnotations(message);
    if (!isStreaming) return resolved;
    /*
     * Only html_tag citations render mid-stream (the pill appears as soon as
     * its annotation resolves); every other selector family stays hidden
     * until the message finishes streaming.
     */
    return resolved.filter((a) => a.target?.selector?.type === 'html_tag');
  }, [isStreaming, message]);
};
