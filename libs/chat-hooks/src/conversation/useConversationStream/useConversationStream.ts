import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import {
  type Conversation,
  generateUUID,
  type MessageCustomContent,
  MessageRole,
  type StreamChunk,
} from '@epam/ai-dial-chat-shared';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { safeDecodeURI } from '../../shared/string-utils';
import {
  DEFAULT_GENERATION_CONFLICT_MESSAGE,
  DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE,
  GenerationConflictError,
  GenerationPersistenceError,
  StreamInterruptedError,
  StreamUpstreamError,
} from '../create-chat-stream-api';
import { applyChunkToMessages } from './apply-chunk';
import {
  type BufferedGeneration,
  restoreBufferedMessage,
} from './buffered-generation';
import { getConversationPath } from './conversation-path';
import { createFrameScheduler } from './frame-scheduler';
import {
  createResumeIfAwaitingGeneration,
  fetchConversationForRecovery,
  hasGeneratedPayload,
  findPendingBackgroundMessageIndex,
  isAwaitingGenerationResume,
} from './generation-resume';

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
  /**
   * Requests the backend stop an active generation. `content` is the answer text shown
   * so far; the backend saves it for a generation whose text it does not hold.
   */
  stopCompletion(params: {
    generationId: string;
    path: string;
    content?: string;
  }): Promise<void>;
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
  /** Notifies the host that a generation just ended (completed or errored), so it can consider disconnecting an idle channel. */
  notifyGenerationSettled?: () => void;
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
  /**
   * Message shown on the message bubble when the backend rejects a completion
   * because this conversation is already generating — the case a second
   * browser tab of the same session hits. Defaults to
   * {@link DEFAULT_GENERATION_CONFLICT_MESSAGE}.
   */
  generationConflictMessage?: string;
  /** Host-translated warning shown when the received answer could not be saved. */
  generationPersistenceErrorMessage?: string;
  /**
   * Receives the original error of every failed stream. The hook shows only
   * host-supplied or upstream-supplied text on the message bubble and hides
   * transport detail (e.g. `Failed to fetch`), so this is where the host can
   * still log or report the raw error.
   */
  onStreamError?: (error: Error) => void;
  /**
   * Coalesces the displayed chunk updates into one `setConversation` per
   * animation frame. Chunks still reach the per-path buffer immediately, and
   * any pending update is flushed before completion, error, stop, or a
   * superseding generation. Defaults to `false` (one update per chunk).
   */
  batchChunksPerFrame?: boolean;
}

/*
 * Picks the text written to `streamErrorMessage`. Only a conflict (host copy)
 * or an upstream DIAL Core error (upstream copy) is displayable; any other
 * error is transport detail and becomes '' so the host renders its localized
 * fallback ([#8979](https://github.com/epam/ai-dial-chat/issues/8979)).
 */
const resolveStreamErrorMessage = (
  error: Error,
  generationConflictMessage: string,
  generationPersistenceErrorMessage: string,
): string => {
  if (error instanceof GenerationPersistenceError)
    return generationPersistenceErrorMessage;
  if (error instanceof GenerationConflictError)
    return generationConflictMessage;
  if (error instanceof StreamUpstreamError) return error.message;
  return '';
};

/** Per-start options of {@link UseConversationStreamResult.startStream}. */
export interface StartStreamOptions {
  /**
   * Treats a `GenerationConflictError` as "this turn is already being
   * generated" — e.g. a page reloaded before that generation saved its start
   * state — and joins the running generation instead of showing the conflict
   * message, which remains the fallback. Only for a start that sends no new
   * user text; a send the user typed must keep reporting the conflict.
   */
  resumeOnConflict?: boolean;
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
    options?: StartStreamOptions,
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
  /** Whether the displayed conversation's terminal read failed. */
  hasConversationReloadError: boolean;
  /** Whether a retry of that read is in flight. */
  isReloadingConversation: boolean;
  /** Retries the failed read without saving or regenerating the answer. */
  retryConversationReload: () => Promise<void>;
}

interface ConversationReloadFailure {
  retry: () => Promise<void>;
  isCurrent: () => boolean;
}

/** Generation id of the displayed conversation's pending background message, if any. */
const findResumedBackgroundGenerationId = (
  conversation: Conversation | null,
): string | undefined => {
  if (!conversation) return undefined;
  const index = findPendingBackgroundMessageIndex(conversation);
  return index === -1
    ? undefined
    : conversation.messages[index].backgroundGeneration?.generationId;
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
  generationConflictMessage = DEFAULT_GENERATION_CONFLICT_MESSAGE,
  generationPersistenceErrorMessage = DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE,
  onStreamError,
  batchChunksPerFrame = false,
}: UseConversationStreamParams): UseConversationStreamResult => {
  /* Read through a ref so a new callback identity never re-creates `startStream`. */
  const onStreamErrorRef = useRef(onStreamError);
  useEffect(() => {
    onStreamErrorRef.current = onStreamError;
  }, [onStreamError]);
  const batchChunksPerFrameRef = useRef(batchChunksPerFrame);
  useEffect(() => {
    batchChunksPerFrameRef.current = batchChunksPerFrame;
  }, [batchChunksPerFrame]);
  /* One pending display write per conversation path while batching. */
  const [frameScheduler] = useState(createFrameScheduler);
  /*
   * Paths with an in-flight generation. A Set (not a boolean) so concurrent
   * generations across conversations each track their own streaming state.
   */
  const [streamingPaths, setStreamingPaths] = useState<Set<string>>(
    () => new Set(),
  );
  /*
   * Paths whose locally started generation Stop can reach, and that
   * generation's id per path. Both are keyed by path so a generation started
   * in another conversation neither hides this one's Stop nor clears its
   * entry when it settles.
   */
  const [stoppablePaths, setStoppablePaths] = useState<Set<string>>(
    () => new Set(),
  );
  const activeGenerationIdsRef = useRef<Map<string, string>>(new Map());
  const resumingPathsRef = useRef<Set<string>>(new Set());
  const bufferedGenerationsRef = useRef<Map<string, BufferedGeneration>>(
    new Map(),
  );
  /* Generation ids stopped by the user — onComplete emits notifyStopGenerating's
   * counterpart (nothing) instead of notifyGenerationEnd for these. */
  const stoppedGenerationIdsRef = useRef<Set<string>>(new Set());
  /*
   * Newest generation id started for each path — see `isSuperseded` in
   * `startStream`. Chunk staleness is checked against this per-path entry, so
   * concurrent generations in different conversations never drop each other.
   */
  const latestGenerationIdsRef = useRef<Map<string, string>>(new Map());
  const mountedRef = useRef(true);
  const reloadFailuresRef = useRef(
    new Map<string, ConversationReloadFailure>(),
  );
  const [reloadFailures, setReloadFailures] = useState(
    reloadFailuresRef.current,
  );
  const retryingRef = useRef(new Set<ConversationReloadFailure>());
  const [retrying, setRetrying] = useState(retryingRef.current);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearReloadError = useCallback((path: string) => {
    if (!reloadFailuresRef.current.has(path)) return;
    const next = new Map(reloadFailuresRef.current);
    next.delete(path);
    reloadFailuresRef.current = next;
    if (mountedRef.current) setReloadFailures(next);
  }, []);

  const reportReloadError = useCallback(
    (path: string, retry: () => Promise<void>, isCurrent: () => boolean) => {
      if (!mountedRef.current || !isCurrent()) return;
      const next = new Map(reloadFailuresRef.current);
      next.set(path, { retry, isCurrent });
      reloadFailuresRef.current = next;
      setReloadFailures(next);
    },
    [],
  );

  const retryConversationReload = useCallback(async () => {
    if (!conversationId) return;
    const failure = reloadFailuresRef.current.get(
      getConversationPath(conversationId),
    );
    if (!failure || !failure.isCurrent() || retryingRef.current.has(failure))
      return;
    retryingRef.current.add(failure);
    setRetrying(new Set(retryingRef.current));
    try {
      await failure.retry();
    } finally {
      retryingRef.current.delete(failure);
      if (mountedRef.current) setRetrying(new Set(retryingRef.current));
    }
  }, [conversationId]);

  /*
   * The host component isn't necessarily remounted when navigating between
   * conversations, so this single hook instance may be reused. Stream
   * callbacks must therefore know which conversation is *currently displayed*
   * to avoid writing chunks/reloads into the wrong conversation's state.
   */
  const displayedConversationIdRef = useRef<string | undefined>(conversationId);
  useEffect(() => {
    displayedConversationIdRef.current = conversationId;
    /* Runs on navigation and on unmount: a write queued for the conversation
       just left must not land in the next one, nor after the host is gone. */
    return () => frameScheduler.cancelAll();
  }, [conversationId, frameScheduler]);

  const isPathDisplayed = useCallback(
    (path: string): boolean =>
      mountedRef.current &&
      getConversationPath(displayedConversationIdRef.current ?? '') === path,
    [],
  );

  const addStreamingPath = useCallback(
    (path: string) => {
      clearReloadError(path);
      setStreamingPaths((prev) => {
        if (prev.has(path)) return prev;
        const next = new Set(prev);
        next.add(path);
        return next;
      });
    },
    [clearReloadError],
  );

  const removeStreamingPath = useCallback((path: string) => {
    setStreamingPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const setPathStoppable = useCallback((path: string, isStoppable: boolean) => {
    setStoppablePaths((prev) => {
      if (prev.has(path) === isStoppable) return prev;
      const next = new Set(prev);
      if (isStoppable) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  /* Forgets `path`'s active generation and its Stop, if `genId` is still it. */
  const releaseActiveGeneration = useCallback(
    (path: string, genId: string) => {
      if (activeGenerationIdsRef.current.get(path) !== genId) return;
      activeGenerationIdsRef.current.delete(path);
      setPathStoppable(path, false);
    },
    [setPathStoppable],
  );

  /*
   * One resume instance shared by the public `resumeIfAwaitingGeneration` and
   * by `startStream`'s recovery of an interrupted stream, so both see the
   * same buffered generations and resuming paths.
   */
  const resumeGeneration = useMemo(
    () =>
      createResumeIfAwaitingGeneration({
        transport,
        setConversation,
        conversationRef,
        resumingPathsRef,
        bufferedGenerationsRef,
        addStreamingPath,
        removeStreamingPath,
        isPathDisplayed,
        generationPersistenceErrorMessage,
        frameScheduler: batchChunksPerFrame ? frameScheduler : undefined,
        stoppedGenerationIdsRef,
        onReloadError: reportReloadError,
        onReloadSuccess: clearReloadError,
      }),
    // setConversation and conversationRef are stable refs — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      addStreamingPath,
      removeStreamingPath,
      isPathDisplayed,
      transport,
      generationPersistenceErrorMessage,
      batchChunksPerFrame,
      frameScheduler,
      reportReloadError,
      clearReloadError,
    ],
  );

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
      options: StartStreamOptions = {},
    ) => {
      const genId = generationId ?? generateUUID();
      const conversationPath = getConversationPath(currentConversationId);
      /* Lands the previous generation's last chunks before it is superseded. */
      frameScheduler.flush(conversationPath);
      resumingPathsRef.current.delete(conversationPath);
      activeGenerationIdsRef.current.set(conversationPath, genId);
      latestGenerationIdsRef.current.set(conversationPath, genId);
      setPathStoppable(conversationPath, true);

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

      /*
       * True once a newer generation has been started on this path: the user
       * stopped this one and immediately re-submitted (Stop re-enables
       * edit/regenerate as soon as the stopped stream closes, while this
       * generation's conversation reload is still in flight). A superseded
       * generation must not clear the new one's streaming state, report its
       * end, or overwrite the conversation with the answer it had fetched.
       */
      const isSuperseded = (): boolean =>
        latestGenerationIdsRef.current.get(conversationPath) !== genId;

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

      /* Releases this generation's streaming, stoppable, and lifecycle state. */
      const releaseGeneration = () => {
        if (!isSuperseded()) removeStreamingPath(conversationPath);
        releaseActiveGeneration(conversationPath, genId);
        completeGeneration(conversationPath, genId);
        channel?.notifyGenerationSettled?.();
      };

      const preserveUnsavedAnswer = () => {
        if (isSuperseded()) return;
        const buffered = bufferedGenerationsRef.current.get(conversationPath);
        if (!buffered || buffered.generationId !== genId) return;
        buffered.message = {
          ...buffered.message,
          streamErrorMessage: generationPersistenceErrorMessage,
        };
        onStreamErrorRef.current?.(new GenerationPersistenceError());
        if (!isPathDisplayed(conversationPath)) return;
        setConversation((prev) => {
          if (!prev || isSuperseded() || !isPathDisplayed(conversationPath))
            return prev;
          const next = restoreBufferedMessage(prev, buffered);
          conversationRef.current = next;
          return next;
        });
      };

      const buffered = bufferedGenerationsRef.current.get(conversationPath);
      const isReloadCurrent = () =>
        mountedRef.current &&
        !isSuperseded() &&
        bufferedGenerationsRef.current.get(conversationPath) === buffered;
      const reloadConversation = async () => {
        /* The generation that superseded this one owns the displayed state
         * and reloads it when it settles. */
        if (!isReloadCurrent()) return;
        /*
         * Only refresh displayed state if the user is still viewing this
         * conversation; otherwise leave the currently-shown chat untouched.
         */
        if (!isPathDisplayed(conversationPath)) {
          if (buffered) bufferedGenerationsRef.current.delete(conversationPath);
          return;
        }
        try {
          /*
           * Reload to confirm persistence and obtain
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
          /* Re-checked after the round trip: a re-submit during it makes this
           * reload stale — it would restore the answer the user just replaced. */
          if (!isReloadCurrent()) return;
          clearReloadError(conversationPath);
          if (!isPathDisplayed(conversationPath)) {
            if (buffered)
              bufferedGenerationsRef.current.delete(conversationPath);
            return;
          }
          /*
           * The backend ended the stream while its background job is still
           * pending (max-duration detach, or a final save it could not make):
           * resume through attach instead of settling or warning.
           */
          if (findPendingBackgroundMessageIndex(refreshed) !== -1) {
            resumeGeneration(currentConversationId, refreshed, {
              seedMessage: buffered?.message,
            });
            return;
          }
          if (
            buffered &&
            buffered.messageIndex === refreshed.messages.length - 1 &&
            isAwaitingGenerationResume(refreshed) &&
            hasGeneratedPayload(buffered.message)
          ) {
            preserveUnsavedAnswer();
            return;
          }
          if (buffered) bufferedGenerationsRef.current.delete(conversationPath);
          setConversation(refreshed);
          conversationRef.current = refreshed;
        } catch {
          if (isReloadCurrent()) {
            reportReloadError(
              conversationPath,
              reloadConversation,
              isReloadCurrent,
            );
          }
        }
      };

      const completionOptions: StreamCompletionOptions = {
        signal: controller.signal,
        onChunk: (chunk) => {
          /*
           * Drop stale chunks from a generation superseded on the same path
           * (regenerate/edit/re-submit). Staleness is keyed by path, not by the
           * hook-wide active id: a generation started in another conversation
           * must not cut off this one, whose chunks still update the per-path
           * buffer so returning before the backend's terminal save restores
           * the complete live message.
           */
          if (isSuperseded()) return;

          const buffered = bufferedGenerationsRef.current.get(conversationPath);
          if (buffered?.generationId === genId) {
            const updated = applyChunkToMessages([buffered.message], 0, chunk);
            if (updated) buffered.message = updated[0];
          }

          if (!isPathDisplayed(conversationPath)) return;
          /*
           * The buffer already holds every chunk, so a batched write only has
           * to publish it once per frame. Without a buffer the chunk itself
           * must be applied, and that write stays immediate.
           */
          if (
            batchChunksPerFrameRef.current &&
            buffered?.generationId === genId
          ) {
            frameScheduler.schedule(conversationPath, () => {
              const flushedBuffer =
                bufferedGenerationsRef.current.get(conversationPath);
              if (
                isSuperseded() ||
                !isPathDisplayed(conversationPath) ||
                flushedBuffer?.generationId !== genId
              )
                return;
              /* Captured now: a superseding generation replaces the buffer
                 entry before React runs this updater. */
              const snapshot = { ...flushedBuffer };
              setConversation((prev) => {
                if (!prev) return prev;
                const next = restoreBufferedMessage(prev, snapshot);
                conversationRef.current = next;
                return next;
              });
            });
            return;
          }
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
          frameScheduler.flush(conversationPath);
          releaseGeneration();
          if (stoppedGenerationIdsRef.current.has(genId)) {
            stoppedGenerationIdsRef.current.delete(genId);
          } else if (!isSuperseded()) {
            overlay?.notifyGenerationEnd?.();
          }
          await reloadConversation();
        },
        onError: (error: Error) => {
          frameScheduler.flush(conversationPath);
          onStreamErrorRef.current?.(error);
          /*
           * A lost or stalled connection says nothing about the backend-owned
           * generation, which usually keeps running ([#8959](https://github.com/epam/ai-dial-chat/issues/8959)): ask the
           * server before showing an error.
           */
          if (error instanceof StreamInterruptedError && !isSuperseded()) {
            void recoverInterruptedStream(error);
            return;
          }
          if (
            error instanceof GenerationConflictError &&
            options.resumeOnConflict &&
            !isSuperseded()
          ) {
            void recoverConflictedStart(error);
            return;
          }
          settleAsFailed(error);
        },
      };

      /* Settles the generation as failed and writes the displayable error text onto its message. */
      const settleAsFailed = (error: Error) => {
        const currentBuffer =
          bufferedGenerationsRef.current.get(conversationPath);
        const buffered =
          currentBuffer?.generationId === genId ? currentBuffer : undefined;
        if (buffered) {
          if (error instanceof GenerationPersistenceError) {
            buffered.message = {
              ...buffered.message,
              streamErrorMessage: generationPersistenceErrorMessage,
            };
          } else {
            bufferedGenerationsRef.current.delete(conversationPath);
          }
        }
        releaseGeneration();
        /* Surface the error only on the conversation the user is viewing,
         * and never over the generation that superseded this one. */
        if (isSuperseded() || !isPathDisplayed(conversationPath)) return;
        /*
         * A conflict is an expected state (another tab is already
         * generating, [#8688](https://github.com/epam/ai-dial-chat/issues/8688)) and gets the host-supplied explanation;
         * an upstream DIAL Core error keeps its own text; every other error
         * is transport detail and falls back to the host's localized copy.
         */
        const streamErrorMessage = resolveStreamErrorMessage(
          error,
          generationConflictMessage,
          generationPersistenceErrorMessage,
        );
        setConversation((prev) => {
          if (!prev || isSuperseded() || !isPathDisplayed(conversationPath))
            return prev;
          const restored =
            buffered?.generationId === genId
              ? restoreBufferedMessage(prev, buffered)
              : prev;
          const updated = {
            ...restored,
            messages: restored.messages.map((m, index) =>
              index === messageIndex ? { ...m, streamErrorMessage } : m,
            ),
          };
          conversationRef.current = updated;
          return updated;
        });
      };

      /* Settles a generation that recovery resolved: finished on the server, or resumed there. */
      const settleRecovered = () => {
        releaseGeneration();
        if (stoppedGenerationIdsRef.current.has(genId)) {
          stoppedGenerationIdsRef.current.delete(genId);
        } else if (!isSuperseded()) {
          overlay?.notifyGenerationEnd?.();
        }
      };

      /*
       * Recovery of an interrupted stream (`generation-stream-recovery`). The
       * path stays streaming and stoppable, and the live partial stays on
       * screen, while the server copy decides the outcome: still generating
       * → rejoin it through the resume flow, seeded with the partial so it
       * never blanks out; already finished → show the saved answer; anything
       * else → the ordinary failure path. Reserving the path in
       * `resumingPathsRef` turns a concurrent reload's own resume into a no-op.
       */
      const recoverInterruptedStream = async (
        error: StreamInterruptedError,
      ) => {
        resumingPathsRef.current.add(conversationPath);
        const server = await fetchConversationForRecovery(
          () => transport.getConversation(safeDecodeURI(currentConversationId)),
          isSuperseded,
        );
        settleFromServerCopy(server, error, false);
      };

      /*
       * Conflict handover for a start that opted into `resumeOnConflict`: the
       * backend is already generating this turn — typically the page was
       * reloaded before that generation saved its start state — so join it the
       * way recovery does instead of showing the conflict. The rejected id has
       * nothing to stop, and a server copy that still ends in this turn's user
       * message is waited out on the recovery schedule.
       */
      const recoverConflictedStart = async (error: GenerationConflictError) => {
        if (activeGenerationIdsRef.current.get(conversationPath) === genId)
          setPathStoppable(conversationPath, false);
        resumingPathsRef.current.add(conversationPath);
        const server = await fetchConversationForRecovery(
          () => transport.getConversation(safeDecodeURI(currentConversationId)),
          isSuperseded,
          (conversation) =>
            conversation.messages.length === messageIndex &&
            conversation.messages.at(-1)?.role === MessageRole.User,
        );
        settleFromServerCopy(server, error, true);
      };

      /*
       * Classifies a recovered server copy against this turn: still generating
       * → rejoin through the resume flow; finished → show it; anything else →
       * settle `error` the ordinary way. A conflict also joins a pending
       * background message wherever it sits.
       */
      const settleFromServerCopy = (
        server: Conversation | null,
        error: Error,
        joinsPendingBackground: boolean,
      ) => {
        if (isSuperseded()) {
          releaseGeneration();
          return;
        }
        const lastMessage = server?.messages[server.messages.length - 1];
        const isSameTurn =
          server != null &&
          server.messages.length - 1 === messageIndex &&
          lastMessage?.role === MessageRole.Assistant;
        const hasPendingBackground =
          joinsPendingBackground &&
          server != null &&
          findPendingBackgroundMessageIndex(server) !== -1;
        if (!server || (!isSameTurn && !hasPendingBackground)) {
          resumingPathsRef.current.delete(conversationPath);
          settleAsFailed(error);
          return;
        }
        const currentBuffer =
          bufferedGenerationsRef.current.get(conversationPath);
        const buffered =
          currentBuffer?.generationId === genId ? currentBuffer : undefined;
        if (isAwaitingGenerationResume(server)) {
          resumeGeneration(currentConversationId, server, {
            /* The local partial belongs to this turn only. */
            seedMessage: isSameTurn ? buffered?.message : undefined,
            skipDedupe: true,
            onSettled: settleRecovered,
          });
          return;
        }
        resumingPathsRef.current.delete(conversationPath);
        if (buffered) bufferedGenerationsRef.current.delete(conversationPath);
        if (isPathDisplayed(conversationPath)) {
          setConversation(server);
          conversationRef.current = server;
        }
        settleRecovered();
      };

      // See client-channel-protocol spec for the full rationale.
      const send = async () => {
        try {
          const clientChannelId =
            channel?.channelId ??
            (await channel?.waitForChannel(CHANNEL_WAIT_TIMEOUT_MS)) ??
            undefined;

          /*
           * Under demand-driven subscribe this wait now routinely suspends on
           * a cold subscribe round trip (rather than resolving immediately, as
           * it usually did while the channel was already up). Stop or a
           * re-submit can therefore land while this await is outstanding.
           * `handleStop` never calls `transport.streamCompletion`, so
           * `stoppedGenerationIdsRef` — not `controller.signal.aborted`, which
           * a plain Stop never sets — is what a user-initiated stop leaves
           * behind; a re-submit is caught by `isSuperseded()` (and, since it
           * replaces an Active entry on the same path, `startGeneration`
           * itself aborts this generation's controller too).
           */
          const isStopped = stoppedGenerationIdsRef.current.has(genId);
          if (controller.signal.aborted || isSuperseded() || isStopped) {
            /*
             * Nothing was ever sent, so there is no stream for onComplete/
             * onError to settle through — perform the same settlement
             * bookkeeping they would have (minus the reload, since no
             * completion was made): release this generation's demand, close
             * out the tracked generation entry, and clear per-path streaming
             * state, so neither the client channel nor the "is generating"
             * state is left stuck.
             */
            if (
              bufferedGenerationsRef.current.get(conversationPath)
                ?.generationId === genId
            ) {
              bufferedGenerationsRef.current.delete(conversationPath);
            }
            if (!isSuperseded()) removeStreamingPath(conversationPath);
            releaseActiveGeneration(conversationPath, genId);
            completeGeneration(conversationPath, genId);
            channel?.notifyGenerationSettled?.();
            if (isStopped) {
              stoppedGenerationIdsRef.current.delete(genId);
            } else if (!isSuperseded()) {
              overlay?.notifyGenerationEnd?.();
            }
            return;
          }

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
      setPathStoppable,
      releaseActiveGeneration,
      isPathDisplayed,
      channel?.channelId,
      channel?.ensureConnected,
      channel?.waitForChannel,
      channel?.notifyGenerationSettled,
      overlay,
      transport,
      resumeGeneration,
      generationConflictMessage,
      generationPersistenceErrorMessage,
      frameScheduler,
      reportReloadError,
      clearReloadError,
    ],
  );

  const restoreBufferedGeneration = useCallback(
    (
      currentConversationId: string,
      conversation: Conversation,
    ): Conversation => {
      const conversationPath = getConversationPath(currentConversationId);
      const buffered = bufferedGenerationsRef.current.get(conversationPath);
      const reloadFailure = reloadFailuresRef.current.get(conversationPath);
      if (
        reloadFailure?.isCurrent() &&
        buffered &&
        conversation.messages.length - 1 >= buffered.messageIndex &&
        conversation.messages[buffered.messageIndex].role ===
          MessageRole.Assistant &&
        !isAwaitingGenerationResume(conversation)
      ) {
        clearReloadError(conversationPath);
        bufferedGenerationsRef.current.delete(conversationPath);
        return conversation;
      }
      return buffered
        ? restoreBufferedMessage(conversation, buffered)
        : conversation;
    },
    [clearReloadError],
  );

  const handleStop = useCallback(() => {
    if (!conversationId) return;
    const conversationPath = getConversationPath(conversationId);
    const localGenId = activeGenerationIdsRef.current.get(conversationPath);
    /*
     * A generation resumed after a refresh has no local id; a background
     * message carries its own, so Stop still reaches the backend for it.
     */
    const genId =
      localGenId ?? findResumedBackgroundGenerationId(conversationRef.current);
    if (!genId) return;

    stoppedGenerationIdsRef.current.add(genId);
    frameScheduler.flush(conversationPath);
    overlay?.notifyStopGenerating?.();
    const content =
      bufferedGenerationsRef.current.get(conversationPath)?.message.content;

    /*
     * Only signal the backend; it aborts upstream, saves the partial, and closes
     * the stream. Keeping our fetch open lets onComplete reload the saved partial
     * race-free (do not reload here — it would race the backend save).
     */
    void transport
      .stopCompletion({ generationId: genId, path: conversationPath, content })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        onStopError?.(error);
      });
  }, [
    conversationId,
    conversationRef,
    frameScheduler,
    onStopError,
    overlay,
    transport,
  ]);

  /* The public entry point takes no options; those are reserved for stream recovery. */
  const resumeIfAwaitingGeneration = useCallback(
    (currentConversationId: string, conversation: Conversation) =>
      resumeGeneration(currentConversationId, conversation),
    [resumeGeneration],
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
    (stoppablePaths.has(displayedConversationPath) ||
      (isStreaming &&
        findResumedBackgroundGenerationId(conversationRef.current) != null));

  const reloadFailure = displayedConversationPath
    ? reloadFailures.get(displayedConversationPath)
    : undefined;
  const hasConversationReloadError = reloadFailure?.isCurrent() ?? false;

  return {
    hasConversationReloadError,
    isReloadingConversation:
      !!reloadFailure &&
      hasConversationReloadError &&
      retrying.has(reloadFailure),
    retryConversationReload,
    startStream,
    handleStop,
    resumeIfAwaitingGeneration,
    restoreBufferedGeneration,
    isStreaming,
    canStopStreaming,
  };
};
