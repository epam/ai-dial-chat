import {
  type Conversation,
  type MessageCustomContent,
} from '@epam/ai-dial-chat-shared';
import type { SendCompletionDtoModeEnum } from '@epam/chat-api-client'; // type-only is fine here — used only as a type annotation
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useGeneration } from '../../context/GenerationContext';
import {
  CompletionMode,
  stopCompletion,
  streamCompletion,
} from '../../server-api/chat-stream.api';
import { getConversation } from '../../server-api/conversations.api';
import { applyChunkToMessages } from '../../utils/apply-chunk';
import { getConversationPath } from '../../utils/conversation-path';

interface Params {
  conversationId: string | undefined;
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
    generationId?: string,
    mode?: SendCompletionDtoModeEnum,
  ) => void;
  handleStop: () => void;
  isStreaming: boolean;
  hasStreamError: boolean;
  setHasStreamError: Dispatch<SetStateAction<boolean>>;
}

export const useConversationStream = ({
  conversationId,
  setConversation,
  conversationRef,
}: Params): Result => {
  // Paths with an in-flight generation. A Set (not a boolean) so concurrent
  // generations across conversations each track their own streaming state.
  const [streamingPaths, setStreamingPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [hasStreamError, setHasStreamError] = useState(false);
  const activeGenerationIdRef = useRef<string | null>(null);
  const { startGeneration, completeGeneration } = useGeneration();

  // ConversationPage is NOT remounted when navigating between conversations
  // (it has no per-id key), so this single hook instance is reused. Stream
  // callbacks must therefore know which conversation is *currently displayed*
  // to avoid writing chunks/reloads into the wrong conversation's state.
  const displayedConversationIdRef = useRef<string | undefined>(conversationId);
  useEffect(() => {
    displayedConversationIdRef.current = conversationId;
  }, [conversationId]);

  const isPathDisplayed = useCallback(
    (path: string): boolean =>
      getConversationPath(displayedConversationIdRef.current ?? '') === path,
    [],
  );

  const addStreamingPath = useCallback((path: string) => {
    setStreamingPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const removeStreamingPath = useCallback((path: string) => {
    setStreamingPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  // An in-flight generation is intentionally NOT aborted on unmount: it is owned
  // by GenerationContext and must survive navigation; only Stop or tab close ends
  // it. (Aborting here would also let StrictMode's remount cancel a fresh stream.)

  const startStream = useCallback(
    (
      currentConversationId: string,
      userContent: string,
      messageIndex: number,
      model: string,
      customContent?: MessageCustomContent,
      generationId?: string,
      mode: SendCompletionDtoModeEnum = CompletionMode.Append,
    ) => {
      const genId = generationId ?? crypto.randomUUID();
      const conversationPath = getConversationPath(currentConversationId);
      activeGenerationIdRef.current = genId;

      // `messageIndex` is the local placeholder index (for onChunk); translate it
      // to the backend's truncation index. Regenerate truncates at the assistant
      // (same index); Edit truncates at the user message (one before it).
      let serverMessageIndex: number | undefined;
      if (mode === CompletionMode.Regenerate) {
        serverMessageIndex = messageIndex;
      } else if (mode === CompletionMode.Edit) {
        serverMessageIndex = messageIndex - 1;
      }

      const controller = startGeneration(conversationPath, genId);
      addStreamingPath(conversationPath);

      streamCompletion(
        conversationPath,
        userContent,
        model,
        {
          signal: controller.signal,
          onChunk: (chunk) => {
            // Drop stale chunks (a newer generation replaced this one) and
            // chunks for a conversation the user is no longer viewing — the
            // backend persists them, so the correct chat reloads them later.
            if (activeGenerationIdRef.current !== genId) return;
            if (!isPathDisplayed(conversationPath)) return;
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
            removeStreamingPath(conversationPath);
            if (activeGenerationIdRef.current === genId) {
              activeGenerationIdRef.current = null;
            }
            completeGeneration(conversationPath, genId);
            // Only refresh displayed state if the user is still viewing this
            // conversation; otherwise leave the currently-shown chat untouched.
            if (!isPathDisplayed(conversationPath)) return;
            try {
              // Backend has already saved the conversation; reload to get server-persisted state
              // (including server-computed fields like stage attachment `data`).
              const refreshed = (await getConversation(
                conversationPath,
              )) as Conversation;
              if (!isPathDisplayed(conversationPath)) return;
              setConversation(refreshed);
              conversationRef.current = refreshed;
            } catch {
              // Non-fatal: keep local state if reload fails
            }
          },
          onError: () => {
            removeStreamingPath(conversationPath);
            if (activeGenerationIdRef.current === genId) {
              activeGenerationIdRef.current = null;
            }
            // Surface the error only on the conversation the user is viewing.
            if (!isPathDisplayed(conversationPath)) return;
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
        genId,
        mode,
        serverMessageIndex,
      );
    },
    // setConversation and conversationRef are stable refs — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      startGeneration,
      completeGeneration,
      addStreamingPath,
      removeStreamingPath,
      isPathDisplayed,
    ],
  );

  const handleStop = useCallback(() => {
    const genId = activeGenerationIdRef.current;
    if (!genId || !conversationId) return;

    const conversationPath = getConversationPath(conversationId);

    // Only signal the backend; it aborts upstream, saves the partial, and closes
    // the stream. Keeping our fetch open lets onComplete reload the saved partial
    // race-free (do not reload here — it would race the backend save).
    void stopCompletion({ generationId: genId, path: conversationPath });
  }, [conversationId]);

  // Reflects only the currently-displayed conversation: a stream running in a
  // different chat must not show this chat as generating.
  const isStreaming =
    conversationId != null &&
    streamingPaths.has(getConversationPath(conversationId));

  return {
    startStream,
    handleStop,
    isStreaming,
    hasStreamError,
    setHasStreamError,
  };
};
