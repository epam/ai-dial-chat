import {
  type Conversation,
  type MessageCustomContent,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import type { ConversationResponseDto } from '@epam/chat-api-client';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { streamCompletion } from '../../server-api/chat-stream.api';
import {
  getConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { applyChunkToMessages } from '../../utils/apply-chunk';
import { getConversationPath } from '../../utils/conversation-path';

interface Params {
  conversationId: string | undefined;
  stoppedGeneratingText: string;
  setConversation: Dispatch<SetStateAction<Conversation | null>>;
  conversationRef: MutableRefObject<Conversation | null>;
}

interface Result {
  startStream: (
    conversationId: string,
    userContent: string,
    messageIndex: number,
    model: string,
    customContent?: MessageCustomContent,
  ) => void;
  handleStop: () => void;
  isStreaming: boolean;
  hasStreamError: boolean;
  setHasStreamError: Dispatch<SetStateAction<boolean>>;
}

export const useConversationStream = ({
  conversationId,
  stoppedGeneratingText,
  setConversation,
  conversationRef,
}: Params): Result => {
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStreamError, setHasStreamError] = useState(false);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startStream = useCallback(
    (
      currentConversationId: string,
      userContent: string,
      messageIndex: number,
      model: string,
      customContent?: MessageCustomContent,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      streamCompletion(
        currentConversationId,
        userContent,
        model,
        {
          signal: controller.signal,
          onChunk: (chunk) => {
            setConversation((prev) => {
              if (!prev) return prev;
              const updatedMessages = applyChunkToMessages(
                prev.messages,
                messageIndex,
                chunk,
              );
              if (!updatedMessages) return prev;
              const next = { ...prev, messages: updatedMessages };
              conversationRef.current = next;
              return next;
            });
          },
          onComplete: async () => {
            setIsStreaming(false);
            abortRef.current = null;
            const final = conversationRef.current;
            if (final) {
              try {
                const conversationPath = getConversationPath(
                  currentConversationId,
                );
                await saveConversation(
                  conversationPath,
                  final as ConversationResponseDto,
                );
                // Reload from server so server-computed fields (e.g. stage
                // attachment `data` extracted by DIAL Core from referenced docs)
                // are available in React state for canvas preview.
                if (!abortRef.current) {
                  const refreshed = (await getConversation(
                    conversationPath,
                  )) as Conversation;
                  setConversation(refreshed);
                  conversationRef.current = refreshed;
                }
              } catch (err: unknown) {
                void err;
              }
            }
          },
          onError: () => {
            setIsStreaming(false);
            abortRef.current = null;
            setHasStreamError(true);
            setConversation((prev) => {
              if (!prev) return prev;
              const updated = {
                ...prev,
                messages: prev.messages.map((m, index) =>
                  index === messageIndex ? { ...m, hasStreamError: true } : m,
                ),
              };
              conversationRef.current = updated;
              return updated;
            });
          },
        },
        customContent,
      );
    },
    // setConversation and conversationRef are stable refs — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setConversation((prev) => {
      if (!prev) return prev;
      const lastMsg = prev.messages[prev.messages.length - 1];
      if (lastMsg?.role !== MessageRole.Assistant) return prev;
      const hasNoContent = !lastMsg.content;
      const stoppedContent = hasNoContent
        ? stoppedGeneratingText
        : lastMsg.content;
      const updated = {
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === lastMsg.id
            ? {
                ...m,
                content: stoppedContent,
                wasStoppedByUser: true,
                ...(hasNoContent && { stoppedWithoutContent: true }),
              }
            : m,
        ),
      };
      conversationRef.current = updated;
      if (conversationId) {
        void saveConversation(
          getConversationPath(conversationId),
          updated as ConversationResponseDto,
        );
      }
      return updated;
    });
  }, [conversationId, stoppedGeneratingText, conversationRef, setConversation]);

  return {
    startStream,
    handleStop,
    isStreaming,
    hasStreamError,
    setHasStreamError,
  };
};
