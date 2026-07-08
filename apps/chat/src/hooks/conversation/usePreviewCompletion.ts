import { Message, MessageRole } from '@epam/ai-dial-chat-shared';
import { useCallback, useRef, useState } from 'react';
import {
  PreviewMessage,
  streamPreviewCompletion,
} from '../../server-api/preview-completion.api';
import { applyChunkToMessages } from '../../utils/apply-chunk';

interface Result {
  messages: Message[];
  sendMessage: (content: string) => void;
  stop: () => void;
  isAssistantTyping: boolean;
  hasStreamError: boolean;
}

/*
 * Separate from `useConversationStream` on purpose: that hook is keyed by a
 * persisted `conversationId`/path (SSE watch, getConversation/saveConversation
 * calls) and has no notion of an ephemeral, never-persisted transcript. This
 * hook owns its history entirely in memory and talks to the stateless
 * preview-completions endpoint, so the two are not worth unifying.
 */
export const usePreviewCompletion = (model: string): Result => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [hasStreamError, setHasStreamError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    (content: string) => {
      const timestamp = new Date().toISOString();
      const userMessage: Message = {
        role: MessageRole.User,
        content,
        timestamp,
      };
      const assistantMessageIndex = messages.length + 1;
      const nextMessages = [
        ...messages,
        userMessage,
        { role: MessageRole.Assistant, content: '', timestamp },
      ];
      setMessages(nextMessages);
      setHasStreamError(false);
      setIsAssistantTyping(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const transcript: PreviewMessage[] = nextMessages
        .slice(0, assistantMessageIndex)
        .map((m) => ({
          role: m.role as MessageRole.User | MessageRole.Assistant,
          content: m.content,
        }));

      streamPreviewCompletion(model, transcript, {
        signal: controller.signal,
        onChunk: (chunk) => {
          setMessages((prev) => {
            const updated = applyChunkToMessages(
              prev,
              assistantMessageIndex,
              chunk,
            );
            return updated ?? prev;
          });
        },
        onComplete: () => {
          setIsAssistantTyping(false);
          abortControllerRef.current = null;
        },
        onError: () => {
          setIsAssistantTyping(false);
          setHasStreamError(true);
          abortControllerRef.current = null;
          setMessages((prev) =>
            prev.map((m, index) =>
              index === assistantMessageIndex
                ? { ...m, hasStreamError: true }
                : m,
            ),
          );
        },
      });
    },
    [messages, model],
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsAssistantTyping(false);
    setMessages((prev) =>
      prev.map((m, index) =>
        index === prev.length - 1 ? { ...m, wasStoppedByUser: true } : m,
      ),
    );
  }, []);

  return { messages, sendMessage, stop, isAssistantTyping, hasStreamError };
};
