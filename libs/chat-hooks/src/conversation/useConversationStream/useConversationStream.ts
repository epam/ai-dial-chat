import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import {
  type Conversation,
  generateUUID,
  type Message,
  type MessageCustomContent,
  type StreamChunk,
} from '@epam/ai-dial-chat-shared';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { safeDecodeURI } from '../../shared/string-utils';
import { applyChunkToMessages } from './apply-chunk';
import { getConversationPath } from './conversation-path';
import { isAwaitingGenerationResume } from './generation-resume';

/*
 * Safety-net only: the primary completion signal is the transport's `watch`
 * event fired when the backend's finalize save happens, independent of how
 * long the generation itself takes. This bounds the wait if that event is
 * ever missed (e.g. a backend crash mid-generation that never finalizes).
 */
const GENERATION_RESUME_WATCH_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * `BufferedGeneration.generationId` for a resumed (not locally-started)
 * generation. `restoreBufferedGeneration`/`onChunk`'s staleness checks never
 * compare against this value — a resume never sets `activeGenerationIdRef` —
 * so any stable placeholder works; it exists only so the buffer entry has a
 * value to carry.
 */
const RESUME_BUFFER_GENERATION_ID = 'awaiting-resume';

/** One event on the `attachToGeneration` SSE stream (`generation-live-replay`). */
type GenerationAttachEvent =
  | { type: 'snapshot'; message: Message }
  | { type: 'chunk'; chunk: StreamChunk }
  | { type: 'done' }
  | { type: 'error'; message?: string }
  | { type: 'stopped' };

/*
 * Bounded wait for the client-channel subscribe to resolve so that
 * completions sent right after mount can carry a channelId. 20 s gives
 * slow connections time to establish the channel while still being
 * meaningfully shorter than the 40 s subscribe default.
 */
const CHANNEL_WAIT_TIMEOUT_MS = 20000;

/** Options accepted by {@link ConversationStreamTransport.streamCompletion}. */
export interface StreamCompletionOptions {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: () => void | Promise<void>;
  onError: (error: Error) => void;
  signal: AbortSignal;
}

/**
 * Host-owned transport for the DIAL Core completion protocol. Implemented at
 * the app edge — never hardcodes an `/api` path, CSRF handling, or a
 * `server-api` import; the library only depends on this interface's shape.
 */
export interface ConversationStreamTransport {
  /** Starts a completion; delivers chunks/completion/error through `options`, aborted via `options.signal`. */
  streamCompletion(
    path: string,
    message: string | undefined,
    model: string,
    options: StreamCompletionOptions,
    customContent?: MessageCustomContent,
    generationId?: string,
    mode?: SendCompletionDtoModeEnum,
    messageIndex?: number,
    clientChannelId?: string,
  ): void;
  /** Requests the backend stop an active generation. */
  stopCompletion(params: { generationId: string; path: string }): Promise<void>;
  /** Opens a stream of resource-update events for `path`, until aborted via `signal`. */
  watchConversation(
    path: string,
    signal: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>>;
  /**
   * Attaches to an active generation's live replay: a `snapshot` event
   * carrying the assistant message as assembled so far, then a `chunk` event
   * per subsequent delta, then exactly one terminal event (`done`/`error`/
   * `stopped`), until aborted via `signal`. Rejects when no active
   * generation exists for `path` — including one that already finished —
   * so the caller can fall back to `watchConversation`.
   */
  attachToGeneration(
    path: string,
    signal: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>>;
  /** Reloads the persisted conversation by its full (bucket-qualified) id. */
  getConversation(
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<Conversation>;
}

/** Host-owned generation lifecycle, backing cross-navigation `AbortController` ownership. */
export interface ConversationGenerationLifecycle {
  /** Starts (or replaces) tracking for a generation on `path`, returning its `AbortController`. */
  startGeneration: (path: string, generationId: string) => AbortController;
  /** Marks the generation identified by `path`/`generationId` complete, if it is still the active one. */
  completeGeneration: (path: string, generationId: string) => void;
}

/** Optional host-owned client-channel connection, used to nudge tool-signin delivery. */
export interface ConversationStreamChannel {
  channelId: string | null;
  ensureConnected: () => void;
  /** Resolves with a channel id, waiting for an in-flight subscribe if one isn't established yet, so a completion sent immediately after mount can still carry it. */
  waitForChannel: (timeoutMs?: number) => Promise<string | null>;
}

/** Optional host-owned overlay generation-lifecycle notifications. Each method is independently optional. */
export interface ConversationStreamOverlayNotifier {
  notifyGenerationStart?: () => void;
  notifyGenerationEnd?: () => void;
  notifyStopGenerating?: () => void;
}

/** Shared mutable channel through which the displayed conversation's state is read/written. */
export interface ConversationStateAccessor {
  setConversation: Dispatch<SetStateAction<Conversation | null>>;
  conversationRef: MutableRefObject<Conversation | null>;
}

/** Parameters for {@link useConversationStream}. */
export interface UseConversationStreamParams {
  conversationId: string | undefined;
  state: ConversationStateAccessor;
  transport: ConversationStreamTransport;
  generation: ConversationGenerationLifecycle;
  channel?: ConversationStreamChannel;
  overlay?: ConversationStreamOverlayNotifier;
  onStopError?: (error: Error) => void;
}

/** Return value of {@link useConversationStream}. */
export interface UseConversationStreamResult {
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
  /** Restores the accumulated live assistant message when its conversation is loaded again before completion. */
  restoreBufferedGeneration: (
    currentConversationId: string,
    conversation: Conversation,
  ) => Conversation;
  isStreaming: boolean;
  canStopStreaming: boolean;
}

interface BufferedGeneration {
  generationId: string;
  messageIndex: number;
  message: Message;
}

const mergeBufferedMessage = (
  current: Message,
  buffered: Message,
): Message => ({
  ...current,
  ...buffered,
  ...((current.custom_content || buffered.custom_content) && {
    custom_content: {
      ...current.custom_content,
      ...buffered.custom_content,
    },
  }),
});

const restoreBufferedMessage = (
  conversation: Conversation,
  buffered: BufferedGeneration,
): Conversation => {
  if (buffered.messageIndex > conversation.messages.length) {
    return conversation;
  }

  const messages = [...conversation.messages];
  if (buffered.messageIndex === messages.length) {
    messages.push(buffered.message);
  } else {
    messages[buffered.messageIndex] = mergeBufferedMessage(
      messages[buffered.messageIndex],
      buffered.message,
    );
  }
  return { ...conversation, messages };
};

/**
 * Owns completion-streaming state: per-path streaming/stoppable tracking,
 * stale-chunk rejection, cross-navigation live-message buffering,
 * reload-after-complete, backend-driven stop, and hard-refresh resume
 * detection — all driven through the injected
 * `transport`/`generation`/`channel`/`overlay` capabilities rather than any
 * app context or `server-api` import.
 */
export const useConversationStream = ({
  conversationId,
  state: { setConversation, conversationRef },
  transport,
  generation: { startGeneration, completeGeneration },
  channel,
  overlay,
  onStopError,
}: UseConversationStreamParams): UseConversationStreamResult => {
  /*
   * Paths with an in-flight generation. A Set (not a boolean) so concurrent
   * generations across conversations each track their own streaming state.
   */
  const [streamingPaths, setStreamingPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [stoppablePath, setStoppablePath] = useState<string | null>(null);
  const activeGenerationIdRef = useRef<string | null>(null);
  const activeGenerationPathRef = useRef<string | null>(null);
  const resumingPathsRef = useRef<Set<string>>(new Set());
  const bufferedGenerationsRef = useRef<Map<string, BufferedGeneration>>(
    new Map(),
  );
  /* Generation ids stopped by the user — onComplete emits notifyStopGenerating's
   * counterpart (nothing) instead of notifyGenerationEnd for these. */
  const stoppedGenerationIdsRef = useRef<Set<string>>(new Set());

  /*
   * The host component isn't necessarily remounted when navigating between
   * conversations, so this single hook instance may be reused. Stream
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
   * An in-flight generation is intentionally NOT aborted on unmount: it is
   * owned by the injected `generation` lifecycle and must survive
   * navigation; only Stop or tab close ends it.
   */

  const startStream = useCallback(
    (
      currentConversationId: string,
      userContent: string,
      messageIndex: number,
      model: string,
      customContent?: MessageCustomContent,
      generationId?: string,
      mode: SendCompletionDtoModeEnum = SendCompletionDtoModeEnum.Append,
    ) => {
      const genId = generationId ?? generateUUID();
      const conversationPath = getConversationPath(currentConversationId);
      activeGenerationIdRef.current = genId;
      activeGenerationPathRef.current = conversationPath;
      setStoppablePath(conversationPath);

      /*
       * `messageIndex` is the local placeholder index (for onChunk); translate it
       * to the backend's truncation index. `Regenerate` truncates at the
       * assistant (same index); `Edit` truncates at the user message (one
       * before it). Any other mode passes no truncation index (append).
       */
      let serverMessageIndex: number | undefined;
      if (mode === SendCompletionDtoModeEnum.Regenerate) {
        serverMessageIndex = messageIndex;
      } else if (mode === SendCompletionDtoModeEnum.Edit) {
        serverMessageIndex = messageIndex - 1;
      }

      const controller = startGeneration(conversationPath, genId);
      const initialMessage = conversationRef.current?.messages[messageIndex];
      if (initialMessage) {
        bufferedGenerationsRef.current.set(conversationPath, {
          generationId: genId,
          messageIndex,
          message: initialMessage,
        });
      } else {
        bufferedGenerationsRef.current.delete(conversationPath);
      }
      addStreamingPath(conversationPath);
      overlay?.notifyGenerationStart?.();

      /*
       * Best-effort: nudge a disconnected client channel to reconnect so a
       * tool-signin event has a chance to reach this completion.
       */
      channel?.ensureConnected();

      const completionOptions: StreamCompletionOptions = {
        signal: controller.signal,
        onChunk: (chunk) => {
          /*
           * Drop stale chunks from a superseded generation. Background chunks
           * still update the per-path buffer, so returning before the backend's
           * terminal save restores the complete live message.
           */
          if (activeGenerationIdRef.current !== genId) return;

          const buffered = bufferedGenerationsRef.current.get(conversationPath);
          if (buffered?.generationId === genId) {
            const updated = applyChunkToMessages([buffered.message], 0, chunk);
            if (updated) buffered.message = updated[0];
          }

          if (!isPathDisplayed(conversationPath)) return;
          setConversation((prev) => {
            if (!prev) return prev;
            const currentBuffer =
              bufferedGenerationsRef.current.get(conversationPath);
            let next: Conversation;
            if (currentBuffer?.generationId === genId) {
              next = restoreBufferedMessage(prev, currentBuffer);
            } else {
              const updatedMessages = applyChunkToMessages(
                prev.messages,
                messageIndex,
                chunk,
              );
              if (!updatedMessages) return prev;
              next = { ...prev, messages: updatedMessages };
            }
            conversationRef.current = next;
            return next;
          });
        },
        onComplete: async () => {
          if (
            bufferedGenerationsRef.current.get(conversationPath)
              ?.generationId === genId
          ) {
            bufferedGenerationsRef.current.delete(conversationPath);
          }
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
            overlay?.notifyGenerationEnd?.();
          }
          /*
           * Only refresh displayed state if the user is still viewing this
           * conversation; otherwise leave the currently-shown chat untouched.
           */
          if (!isPathDisplayed(conversationPath)) return;
          try {
            /*
             * Backend has already saved the conversation; reload to get
             * server-persisted state (including server-computed fields
             * like stage attachment `data`). Unlike `streamCompletion`/
             * `watchConversation` (which take the bucket-stripped
             * `conversationPath`), `getConversation` needs the full
             * `{bucket}/{name}` path — already-percent-encoded segments
             * are decoded back to raw first so the transport's own
             * encoding doesn't double-encode them.
             */
            const refreshed = await transport.getConversation(
              safeDecodeURI(currentConversationId),
            );
            if (!isPathDisplayed(conversationPath)) return;
            setConversation(refreshed);
            conversationRef.current = refreshed;
          } catch {
            // Non-fatal: keep local state if reload fails
          }
        },
        onError: (error: Error) => {
          const currentBuffer =
            bufferedGenerationsRef.current.get(conversationPath);
          const buffered =
            currentBuffer?.generationId === genId ? currentBuffer : undefined;
          if (buffered) bufferedGenerationsRef.current.delete(conversationPath);
          removeStreamingPath(conversationPath);
          if (activeGenerationIdRef.current === genId) {
            activeGenerationIdRef.current = null;
            activeGenerationPathRef.current = null;
            setStoppablePath(null);
          }
          // Surface the error only on the conversation the user is viewing.
          if (!isPathDisplayed(conversationPath)) return;
          setConversation((prev) => {
            if (!prev) return prev;
            const restored =
              buffered?.generationId === genId
                ? restoreBufferedMessage(prev, buffered)
                : prev;
            const updated = {
              ...restored,
              messages: restored.messages.map((m, index) =>
                index === messageIndex
                  ? { ...m, streamErrorMessage: error.message }
                  : m,
              ),
            };
            conversationRef.current = updated;
            return updated;
          });
        },
      };

      // See client-channel-protocol spec for the full rationale.
      const send = async () => {
        try {
          const clientChannelId =
            channel?.channelId ??
            (await channel?.waitForChannel(CHANNEL_WAIT_TIMEOUT_MS)) ??
            undefined;
          transport.streamCompletion(
            conversationPath,
            userContent,
            model,
            completionOptions,
            customContent,
            genId,
            mode,
            serverMessageIndex,
            clientChannelId,
          );
        } catch (err: unknown) {
          /* streamCompletion is typed void but may throw synchronously; route
           * through onError to preserve the error semantics the calling effect
           * previously got from a synchronous throw. */
          completionOptions.onError(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      };
      void send();
    },
    // setConversation and conversationRef are stable refs — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      startGeneration,
      completeGeneration,
      addStreamingPath,
      removeStreamingPath,
      isPathDisplayed,
      channel?.channelId,
      channel?.ensureConnected,
      channel?.waitForChannel,
      overlay,
      transport,
    ],
  );

  const restoreBufferedGeneration = useCallback(
    (
      currentConversationId: string,
      conversation: Conversation,
    ): Conversation => {
      const conversationPath = getConversationPath(currentConversationId);
      const buffered = bufferedGenerationsRef.current.get(conversationPath);
      return buffered
        ? restoreBufferedMessage(conversation, buffered)
        : conversation;
    },
    [],
  );

  const handleStop = useCallback(() => {
    const genId = activeGenerationIdRef.current;
    if (!genId || !conversationId) return;

    const conversationPath = getConversationPath(conversationId);
    if (activeGenerationPathRef.current !== conversationPath) return;

    stoppedGenerationIdsRef.current.add(genId);
    overlay?.notifyStopGenerating?.();

    /*
     * Only signal the backend; it aborts upstream, saves the partial, and closes
     * the stream. Keeping our fetch open lets onComplete reload the saved partial
     * race-free (do not reload here — it would race the backend save).
     */
    void transport
      .stopCompletion({ generationId: genId, path: conversationPath })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        onStopError?.(error);
      });
  }, [conversationId, onStopError, overlay, transport]);

  /*
   * A hard refresh mid-generation loads a conversation whose last message is
   * the backend's empty start-state placeholder (no incremental save exists
   * to show partial content). Rather than leaving that static and forever
   * empty, mark the path as streaming — for free, this reuses the same
   * typing indicator and any isStreaming guards a composed handlers hook
   * already applies — and watch the conversation's existing resource-update
   * channel until the backend's finalize save resolves the placeholder.
   */
  const resumeIfAwaitingGeneration = useCallback(
    (currentConversationId: string, conversation: Conversation): void => {
      if (!isAwaitingGenerationResume(conversation)) return;

      const conversationPath = getConversationPath(currentConversationId);
      if (resumingPathsRef.current.has(conversationPath)) return;
      resumingPathsRef.current.add(conversationPath);
      addStreamingPath(conversationPath);

      const messageIndex = conversation.messages.length - 1;

      const finish = (result?: Conversation) => {
        resumingPathsRef.current.delete(conversationPath);
        removeStreamingPath(conversationPath);
        bufferedGenerationsRef.current.delete(conversationPath);
        if (result && isPathDisplayed(conversationPath)) {
          setConversation(result);
          conversationRef.current = result;
        }
      };

      const finalCheck = async () => {
        try {
          const result = await transport.getConversation(
            safeDecodeURI(currentConversationId),
          );
          finish(result);
        } catch {
          finish();
        }
      };

      const applySnapshot = (message: Message) => {
        const buffered = {
          generationId: RESUME_BUFFER_GENERATION_ID,
          messageIndex,
          message,
        };
        bufferedGenerationsRef.current.set(conversationPath, buffered);
        if (!isPathDisplayed(conversationPath)) return;
        setConversation((prev) => {
          if (!prev) return prev;
          const next = restoreBufferedMessage(prev, buffered);
          conversationRef.current = next;
          return next;
        });
      };

      const applyAttachChunk = (chunk: StreamChunk) => {
        const buffered = bufferedGenerationsRef.current.get(conversationPath);
        if (buffered?.generationId === RESUME_BUFFER_GENERATION_ID) {
          const updated = applyChunkToMessages([buffered.message], 0, chunk);
          if (updated) buffered.message = updated[0];
        }
        if (!isPathDisplayed(conversationPath)) return;
        setConversation((prev) => {
          if (!prev) return prev;
          const currentBuffer =
            bufferedGenerationsRef.current.get(conversationPath);
          if (currentBuffer?.generationId !== RESUME_BUFFER_GENERATION_ID) {
            return prev;
          }
          const next = restoreBufferedMessage(prev, currentBuffer);
          conversationRef.current = next;
          return next;
        });
      };

      /*
       * Watch for a terminal update via the generic conversation-update SSE
       * channel and re-check `isAwaitingGenerationResume` — the pre-existing
       * behavior, unchanged, and the fallback whenever attach can't be used
       * (older backend during a rollout, attach opened but ended without a
       * terminal event, or its own timeout elapsed).
       */
      const runWatch = async () => {
        const watchController = new AbortController();
        let stream: ReadableStream<Uint8Array>;
        try {
          stream = await transport.watchConversation(
            conversationPath,
            watchController.signal,
          );
        } catch {
          await finalCheck();
          return;
        }

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const timeoutId = window.setTimeout(() => {
          watchController.abort();
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
                const result = await transport.getConversation(
                  safeDecodeURI(currentConversationId),
                );
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
         * last check before giving up, so regenerate/edit become available
         * again either way.
         */
        await finalCheck();
      };

      /*
       * Attaches to the backend's live replay of the in-flight generation, if
       * one is available. Returns `true` when it fully resolved the resume
       * (a genuine terminal event arrived, or its own timeout elapsed — both
       * end in a `finalCheck`), or `false` when the caller should fall back
       * to `runWatch` (attach couldn't open at all, or its stream ended
       * without ever seeing a terminal event).
       */
      const runAttach = async (): Promise<boolean> => {
        const attachController = new AbortController();
        let reader: ReadableStreamDefaultReader<Uint8Array>;
        try {
          const stream = await transport.attachToGeneration(
            conversationPath,
            attachController.signal,
          );
          reader = stream.getReader();
        } catch {
          return false;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let sawTimeout = false;
        let sawTerminal = false;

        const timeoutId = window.setTimeout(() => {
          sawTimeout = true;
          attachController.abort();
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
              let event: GenerationAttachEvent | null = null;
              try {
                event = JSON.parse(data) as GenerationAttachEvent;
              } catch {
                continue;
              }
              if (!event) continue;

              switch (event.type) {
                case 'snapshot':
                  applySnapshot(event.message);
                  break;
                case 'chunk':
                  applyAttachChunk(event.chunk);
                  break;
                case 'done':
                case 'error':
                case 'stopped':
                  sawTerminal = true;
                  break;
              }
            }
            if (sawTerminal) break;
          }
        } catch {
          // Network error, or our own timeout-abort — handled below.
        } finally {
          clearTimeout(timeoutId);
          reader.releaseLock();
        }

        if (sawTerminal) {
          await finalCheck();
          return true;
        }
        if (sawTimeout) {
          await finalCheck();
          return true;
        }
        return false;
      };

      const resume = async () => {
        const handled = await runAttach();
        if (!handled) await runWatch();
      };
      void resume();
    },
    // setConversation and conversationRef are stable refs — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addStreamingPath, removeStreamingPath, isPathDisplayed, transport],
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
    restoreBufferedGeneration,
    isStreaming,
    canStopStreaming,
  };
};
