import type { Annotation, Message } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { resolveMessageAnnotations } from './annotation';

/**
 * Returns the resolved annotation list for an assistant message.
 * Returns an empty array while streaming is in progress.
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
