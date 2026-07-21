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
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import {
  CompletionMode,
  stopCompletion,
  streamCompletion,
} from '../../server-api/chat-stream.api';
import {
  getConversation,
  watchConversation,
} from '../../server-api/conversations.api';
import { applyChunkToMessages } from '../../utils/apply-chunk';
import { getConversationPath } from '../../utils/conversation-path';
import { isAwaitingGenerationResume } from '../../utils/generation-resume';
import { safeDecodeURIComponent } from '../../utils/string-utils';

/*
 * Safety-net only: the primary completion signal is the `/watch` SSE event
 * fired when the backend's finalize() save happens, independent of how long
 * the generation itself takes. This bounds the wait if that event is ever
 * missed (e.g. a backend crash mid-generation that never reaches finalize()).
 */
const GENERATION_RESUME_WATCH_TIMEOUT_MS = 5 * 60 * 1000;

interface Params {
  conversationId: string | undefined;
  setConversation: Dispatch<SetStateAction<Conversation | null>>;
  conversationRef: MutableRefObject<Conversation | null>;
  onStopError?: (error: Error) => void;
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
  resumeIfAwaitingGeneration: (
    currentConversationId: string,
    conversation: Conversation,
  ) => void;
  isStreaming: boolean;
  canStopStreaming: boolean;
  hasStreamError: boolean;
  setHasStreamError: Dispatch<SetStateAction<boolean>>;
}

export const useConversationStream = ({
  conversationId,
  setConversation,
  conversationRef,
  onStopError,
}: Params): Result => {
  /*
   * Paths with an in-flight generation. A Set (not a boolean) so concurrent
   * generations across conversations each track their own streaming state.
   */
  const [streamingPaths, setStreamingPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [stoppablePath, setStoppablePath] = useState<string | null>(null);
  const [hasStreamError, setHasStreamError] = useState(false);
  const activeGenerationIdRef = useRef<string | null>(null);
  const activeGenerationPathRef = useRef<string | null>(null);
  const resumingPathsRef = useRef<Set<string>>(new Set());
  /* Generation ids stopped by the user — onComplete emits STOP_GENERATING's
   * counterpart (nothing) instead of GPT_END_GENERATING for these. */
  const stoppedGenerationIdsRef = useRef<Set<string>>(new Set());
  const { startGeneration, completeGeneration } = useGeneration();
  const overlay = useOptionalOverlay();

  /*
   * ConversationPage is NOT remounted when navigating between conversations
   * (it has no per-id key), so this single hook instance is reused. Stream
   * callbacks must therefore know which conversation is *currently displayed*
   * to avoid writing chunks/reloads into the wrong conversation's state.
   */
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

  /*
   * An in-flight generation is intentionally NOT aborted on unmount: it is owned
   * by GenerationContext and must survive navigation; only Stop or tab close ends
   * it. (Aborting here would also let StrictMode's remount cancel a fresh stream.)
   */

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
      activeGenerationPathRef.current = conversationPath;
      setStoppablePath(conversationPath);

      /*
       * `messageIndex` is the local placeholder index (for onChunk); translate it
       * to the backend's truncation index. Regenerate truncates at the assistant
       * (same index); Edit truncates at the user message (one before it).
       */
      let serverMessageIndex: number | undefined;
      if (mode === CompletionMode.Regenerate) {
        serverMessageIndex = messageIndex;
      } else if (mode === CompletionMode.Edit) {
        serverMessageIndex = messageIndex - 1;
      }

      const controller = startGeneration(conversationPath, genId);
      addStreamingPath(conversationPath);
      overlay?.notifyGenerationStart();

      streamCompletion(
        conversationPath,
        userContent,
        model,
        {
          signal: controller.signal,
          onChunk: (chunk) => {
            /*
             * Drop stale chunks (a newer generation replaced this one) and
             * chunks for a conversation the user is no longer viewing — the
             * backend persists them, so the correct chat reloads them later.
             */
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
              activeGenerationPathRef.current = null;
              setStoppablePath(null);
            }
            completeGeneration(conversationPath, genId);
            if (stoppedGenerationIdsRef.current.has(genId)) {
              stoppedGenerationIdsRef.current.delete(genId);
            } else {
              overlay?.notifyGenerationEnd();
            }
            /*
             * Only refresh displayed state if the user is still viewing this
             * conversation; otherwise leave the currently-shown chat untouched.
             */
            if (!isPathDisplayed(conversationPath)) return;
            try {
              /*
               * Backend has already saved the conversation; reload to get server-persisted state
               * (including server-computed fields like stage attachment `data`).
               */
              const refreshed = (await getConversation(
                safeDecodeURIComponent(currentConversationId),
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
              activeGenerationPathRef.current = null;
              setStoppablePath(null);
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
      overlay,
    ],
  );

  const handleStop = useCallback(() => {
    const genId = activeGenerationIdRef.current;
    if (!genId || !conversationId) return;

    const conversationPath = getConversationPath(conversationId);
    if (activeGenerationPathRef.current !== conversationPath) return;

    stoppedGenerationIdsRef.current.add(genId);
    overlay?.notifyStopGenerating();

    /*
     * Only signal the backend; it aborts upstream, saves the partial, and closes
     * the stream. Keeping our fetch open lets onComplete reload the saved partial
     * race-free (do not reload here — it would race the backend save).
     */
    void stopCompletion({ generationId: genId, path: conversationPath }).catch(
      (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setHasStreamError(true);
        onStopError?.(error);
      },
    );
  }, [conversationId, onStopError, overlay]);

  /*
   * A hard refresh mid-generation loads a conversation whose last message is
   * the backend's empty start-state placeholder (no incremental save exists
   * to show partial content). Rather than leaving that static and forever
   * empty, mark the path as streaming — for free, this reuses the same
   * typing indicator and the isStreaming guards already in
   * useConversationHandlers (regenerate/edit/starter no-op while streaming)
   * — and watch the conversation's existing resource-update SSE channel
   * until the backend's finalize() save resolves the placeholder.
   */
  const resumeIfAwaitingGeneration = useCallback(
    (currentConversationId: string, conversation: Conversation): void => {
      if (!isAwaitingGenerationResume(conversation)) return;

      const conversationPath = getConversationPath(currentConversationId);
      if (resumingPathsRef.current.has(conversationPath)) return;
      resumingPathsRef.current.add(conversationPath);
      addStreamingPath(conversationPath);

      const controller = new AbortController();

      const finish = (result?: Conversation) => {
        resumingPathsRef.current.delete(conversationPath);
        removeStreamingPath(conversationPath);
        if (result && isPathDisplayed(conversationPath)) {
          setConversation(result);
          conversationRef.current = result;
        }
      };

      const finalCheck = async () => {
        try {
          const result = (await getConversation(
            safeDecodeURIComponent(currentConversationId),
          )) as Conversation;
          finish(result);
        } catch {
          finish();
        }
      };

      const run = async () => {
        let stream: ReadableStream<Uint8Array>;
        try {
          stream = await watchConversation(conversationPath, controller.signal);
        } catch {
          await finalCheck();
          return;
        }

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const timeoutId = window.setTimeout(() => {
          controller.abort();
        }, GENERATION_RESUME_WATCH_TIMEOUT_MS);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;

              const data = trimmed.slice(5).trim();
              let event: { action?: string } | null = null;
              try {
                event = JSON.parse(data) as { action?: string };
              } catch {
                continue;
              }

              if (event?.action !== 'UPDATE') continue;

              try {
                const result = (await getConversation(
                  safeDecodeURIComponent(currentConversationId),
                )) as Conversation;
                if (!isAwaitingGenerationResume(result)) {
                  finish(result);
                  return;
                }
              } catch {
                // Keep watching until stream ends or timeout.
              }
            }
          }
        } catch {
          /*
           * AbortError on timeout, or unexpected stream error — fall through
           * to the final check below.
           */
        } finally {
          clearTimeout(timeoutId);
          reader.releaseLock();
        }

        /*
         * Timed out or the stream ended without a qualifying event: do one
         * last check before giving up, so Regenerate/edit become available
         * again either way.
         */
        await finalCheck();
      };

      void run();
    },
    // setConversation and conversationRef are stable refs — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addStreamingPath, removeStreamingPath, isPathDisplayed],
  );

  /*
   * Reflects only the currently-displayed conversation: a stream running in a
   * different chat must not show this chat as generating.
   */
  const isStreaming =
    conversationId != null &&
    streamingPaths.has(getConversationPath(conversationId));
  const displayedConversationPath =
    conversationId != null ? getConversationPath(conversationId) : null;
  const canStopStreaming =
    displayedConversationPath != null &&
    stoppablePath === displayedConversationPath;

  return {
    startStream,
    handleStop,
    resumeIfAwaitingGeneration,
    isStreaming,
    canStopStreaming,
    hasStreamError,
    setHasStreamError,
  };
};
