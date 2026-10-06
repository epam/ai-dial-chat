import {
  BackgroundGenerationStatus,
  type Conversation,
  MessageRole,
  type Message,
  type StreamChunk,
} from '@epam/ai-dial-chat-shared';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { safeDecodeURI } from '../../shared/string-utils';
import {
  DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE,
  GenerationPersistenceError,
} from '../create-chat-stream-api';
import { applyChunkToMessages } from './apply-chunk';
import {
  type BufferedGeneration,
  restoreBufferedMessage,
} from './buffered-generation';
import { getConversationPath } from './conversation-path';
import type { FrameScheduler } from './frame-scheduler';
import type { ConversationStreamTransport } from './useConversationStream';

/**
 * True when the assistant message carries anything the backend's finalize save
 * would have written. Text alone is not enough to tell a finished response from
 * the start-state placeholder: an image-generation answer settles with an empty
 * `content` and only `custom_content.attachments`, and a stage-only or
 * form-only answer is just as text-free.
 */
export const hasGeneratedPayload = (message: Message): boolean => {
  const customContent = message.custom_content;
  return (
    !!message.content ||
    message.responseId != null ||
    !!customContent?.attachments?.length ||
    !!customContent?.stages?.length ||
    !!customContent?.annotations?.length ||
    !!customContent?.form_schema ||
    customContent?.state != null
  );
};

/**
 * Index of the conversation's message that a background generation is still
 * producing (`backgroundGeneration.status` is `pending`), or -1. It can sit
 * anywhere, e.g. before a model-changed status message.
 */
export const findPendingBackgroundMessageIndex = (
  conversation: Conversation,
): number =>
  conversation.messages.findIndex(
    (message) =>
      message.backgroundGeneration?.status ===
      BackgroundGenerationStatus.Pending,
  );

/**
 * True when the conversation has a pending background message, or its last
 * message is an unresolved assistant placeholder: the backend only persists a
 * conversation at generation start (empty placeholder) and at generation end
 * (final content, or a partial flagged `streamErrorMessage`/`wasStoppedByUser`).
 * This can mean generation is still active elsewhere, or that its terminal save
 * failed.
 */
export const isAwaitingGenerationResume = (
  conversation: Conversation,
): boolean => {
  if (findPendingBackgroundMessageIndex(conversation) !== -1) return true;
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  return (
    !!lastMessage &&
    lastMessage.role === MessageRole.Assistant &&
    !hasGeneratedPayload(lastMessage) &&
    lastMessage.streamErrorMessage == null &&
    !lastMessage.wasStoppedByUser
  );
};

/*
 * Fallback-path safety net only (`runWatch`). The generic conversation-watch
 * channel has no guarantee it will ever emit again for a given path, so that
 * path bounds its wait. `runAttach` deliberately has no such timeout: it is
 * a direct subscription to the generation's own lifecycle (kept alive by the
 * backend's periodic SSE keepalive), so it naturally ends when a genuine
 * terminal event arrives — imposing an arbitrary cutoff there would abandon
 * (and visibly erase the progress of) a legitimately long-running generation
 * such as a multi-stage agent/Deep Research run ([#8494](https://github.com/epam/ai-dial-chat/issues/8494)).
 */
const GENERATION_RESUME_WATCH_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * `BufferedGeneration.generationId` for a resumed (not locally-started)
 * generation. `restoreBufferedGeneration`/`startStream`'s `onChunk` staleness
 * checks never compare against this value — a resume never sets
 * `activeGenerationIdRef` — so any stable placeholder works; it exists only
 * so the buffer entry has a value to carry.
 */
const RESUME_BUFFER_GENERATION_ID = 'awaiting-resume';

/*
 * Retry delays for the conversation re-fetch that follows an interrupted
 * stream: six attempts over ~31 s, covering a network that rejoins a few
 * seconds after the device wakes, without leaving the composer blocked
 * indefinitely when it never does.
 */
export const RECOVERY_REFETCH_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

/** Resolves after `delayMs`, or as soon as the browser reports it is back online. */
const waitForRetry = (delayMs: number): Promise<void> =>
  new Promise<void>((resolve) => {
    const hasWindow = typeof window !== 'undefined';
    const handleReady = () => {
      clearTimeout(timer);
      if (hasWindow) window.removeEventListener('online', handleReady);
      resolve();
    };
    const timer = setTimeout(handleReady, delayMs);
    if (hasWindow) window.addEventListener('online', handleReady);
  });

/**
 * Returns the conversation from `load`, retrying rejected attempts — and
 * results `isPending` flags as not yet settled — on the
 * {@link RECOVERY_REFETCH_DELAYS_MS} schedule; `null` once every attempt has
 * failed or stayed pending, or `shouldStop` turns true between attempts.
 */
export const fetchConversationForRecovery = async (
  load: () => Promise<Conversation>,
  shouldStop: () => boolean,
  isPending?: (conversation: Conversation) => boolean,
): Promise<Conversation | null> => {
  for (
    let attempt = 0;
    attempt <= RECOVERY_REFETCH_DELAYS_MS.length;
    attempt++
  ) {
    if (shouldStop()) return null;
    try {
      const conversation = await load();
      if (!isPending?.(conversation)) return conversation;
    } catch {
      /* Retried below, like a pending result. */
    }
    if (attempt === RECOVERY_REFETCH_DELAYS_MS.length) return null;
    await waitForRetry(RECOVERY_REFETCH_DELAYS_MS[attempt]);
  }
  return null;
};

/** One event on the `attachToGeneration` SSE stream (`generation-live-replay`). */
type GenerationAttachEvent =
  | { type: 'snapshot'; message: Message }
  | { type: 'chunk'; chunk: StreamChunk }
  | { type: 'done' }
  | { type: 'error'; message?: string; errorType?: string }
  | { type: 'stopped' };

/**
 * Reads a newline-delimited SSE stream, JSON-decoding each `data:` line and
 * passing it to `onEvent`. Stops reading — and always releases the reader —
 * as soon as `onEvent` returns `true`, when the stream ends, or when
 * `reader.read()` rejects (a network error, or the caller aborting the
 * stream's own `AbortSignal`, e.g. on timeout). Malformed lines and
 * non-`data:` lines (comments, keepalives) are skipped silently.
 */
const readSseEvents = async <TEvent>(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: TEvent) => Promise<boolean> | boolean,
): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let shouldStop = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        let event: TEvent;
        try {
          event = JSON.parse(data) as TEvent;
        } catch {
          continue;
        }
        if (await onEvent(event)) {
          shouldStop = true;
          break;
        }
      }
      if (shouldStop) break;
    }
  } catch {
    /*
     * Network error, or the caller's own AbortSignal fired (timeout) — the
     * caller tracks its own timeout flag separately and decides what to do.
     */
  } finally {
    reader.releaseLock();
  }
};

/** Internal options a resume started by the stream hook itself passes; the public API passes none. */
export interface ResumeGenerationOptions {
  /** Initial buffered message, used instead of the stored placeholder — the live partial answer a dropped stream had already shown. */
  seedMessage?: Message;
  /** Called once when the resume has resolved or lost ownership of the path to a newer generation. */
  onSettled?: () => void;
  /** Resumes even though the path is already in `resumingPathsRef`, for a caller that reserved it itself. */
  skipDedupe?: boolean;
}

/** Host-owned state {@link createResumeIfAwaitingGeneration} reads/writes through. */
export interface ResumeIfAwaitingGenerationDeps {
  transport: ConversationStreamTransport;
  setConversation: Dispatch<SetStateAction<Conversation | null>>;
  conversationRef: MutableRefObject<Conversation | null>;
  resumingPathsRef: MutableRefObject<Set<string>>;
  bufferedGenerationsRef: MutableRefObject<Map<string, BufferedGeneration>>;
  addStreamingPath: (path: string) => void;
  removeStreamingPath: (path: string) => void;
  isPathDisplayed: (path: string) => boolean;
  generationPersistenceErrorMessage?: string;
  /** Records a terminal read failure and its guarded read-only retry. */
  onReloadError?: (
    path: string,
    retry: () => Promise<void>,
    isCurrent: () => boolean,
  ) => void;
  /** Clears a previous read failure after reconciliation. */
  onReloadSuccess?: (path: string) => void;
  /** When set, replayed chunks are published at most once per frame through it. */
  frameScheduler?: FrameScheduler;
  /**
   * Generation ids the user stopped. A resumed background generation in this set
   * ignores further replayed chunks (DIAL Core does not always honour the cancel), and
   * its id is removed when the resume settles.
   */
  stoppedGenerationIdsRef?: MutableRefObject<Set<string>>;
}

/**
 * Builds `resumeIfAwaitingGeneration`: a hard refresh mid-generation loads a
 * conversation whose last message is the backend's empty start-state
 * placeholder (no incremental save exists to show partial content). Rather
 * than leaving that static and forever empty, this marks the path as
 * streaming — for free, reusing the same typing indicator and any
 * `isStreaming` guards a composed handlers hook already applies — and
 * attaches to the backend's live replay of the in-flight generation
 * (`transport.attachToGeneration`), showing the assistant message populate
 * progressively. It falls back to watching the conversation's generic
 * resource-update channel (`transport.watchConversation`) until the
 * backend's finalize save resolves the placeholder whenever attach is
 * unavailable or ends without a terminal event.
 */
export const createResumeIfAwaitingGeneration = ({
  transport,
  setConversation,
  conversationRef,
  resumingPathsRef,
  bufferedGenerationsRef,
  addStreamingPath,
  removeStreamingPath,
  isPathDisplayed,
  generationPersistenceErrorMessage = DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE,
  frameScheduler,
  stoppedGenerationIdsRef,
  onReloadError,
  onReloadSuccess,
}: ResumeIfAwaitingGenerationDeps) => {
  return (
    currentConversationId: string,
    conversation: Conversation,
    options: ResumeGenerationOptions = {},
  ): void => {
    if (!isAwaitingGenerationResume(conversation)) {
      options.onSettled?.();
      return;
    }

    const conversationPath = getConversationPath(currentConversationId);
    /* Another resume already owns this path and will settle it. */
    if (!options.skipDedupe && resumingPathsRef.current.has(conversationPath))
      return;
    resumingPathsRef.current.add(conversationPath);
    addStreamingPath(conversationPath);

    const pendingBackgroundIndex =
      findPendingBackgroundMessageIndex(conversation);
    const isBackground = pendingBackgroundIndex !== -1;
    const messageIndex = isBackground
      ? pendingBackgroundIndex
      : conversation.messages.length - 1;
    const resumedBuffer: BufferedGeneration = {
      generationId: RESUME_BUFFER_GENERATION_ID,
      messageIndex,
      message: options.seedMessage ?? conversation.messages[messageIndex],
    };
    bufferedGenerationsRef.current.set(conversationPath, resumedBuffer);
    const ownsBuffer = () =>
      bufferedGenerationsRef.current.get(conversationPath) === resumedBuffer;
    const backgroundGenerationId = isBackground
      ? conversation.messages[messageIndex].backgroundGeneration?.generationId
      : undefined;
    const isStoppedByUser = () =>
      backgroundGenerationId != null &&
      (stoppedGenerationIdsRef?.current.has(backgroundGenerationId) ?? false);

    const finish = (result?: Conversation, persistenceFailed = false) => {
      frameScheduler?.flush(conversationPath);
      if (backgroundGenerationId != null) {
        stoppedGenerationIdsRef?.current.delete(backgroundGenerationId);
      }
      if (!ownsBuffer()) return;
      resumingPathsRef.current.delete(conversationPath);
      removeStreamingPath(conversationPath);
      /*
       * A reload that still shows a pending background message is not a lost
       * save: the job is still running in DIAL Core, so no warning is shown.
       * Nothing resumes it from here; the stored message stays pending until
       * the conversation is opened again.
       */
      const placeholderReload =
        !isBackground &&
        result &&
        result.messages.length - 1 === messageIndex &&
        isAwaitingGenerationResume(result) &&
        hasGeneratedPayload(resumedBuffer.message);
      if (persistenceFailed || placeholderReload) {
        resumedBuffer.message = {
          ...resumedBuffer.message,
          streamErrorMessage: generationPersistenceErrorMessage,
        };
        if (isPathDisplayed(conversationPath)) {
          setConversation((prev) => {
            if (!prev || !ownsBuffer() || !isPathDisplayed(conversationPath))
              return prev;
            const next = restoreBufferedMessage(prev, resumedBuffer);
            conversationRef.current = next;
            return next;
          });
        }
        return;
      }
      bufferedGenerationsRef.current.delete(conversationPath);
      if (result && isPathDisplayed(conversationPath)) {
        setConversation(result);
        conversationRef.current = result;
      }
    };

    const finalCheck = async () => {
      if (!ownsBuffer()) return;
      try {
        const result = await transport.getConversation(
          safeDecodeURI(currentConversationId),
        );
        if (!ownsBuffer()) return;
        onReloadSuccess?.(conversationPath);
        finish(result);
      } catch {
        if (!ownsBuffer()) return;
        frameScheduler?.flush(conversationPath);
        resumingPathsRef.current.delete(conversationPath);
        removeStreamingPath(conversationPath);
        if (backgroundGenerationId != null) {
          stoppedGenerationIdsRef?.current.delete(backgroundGenerationId);
        }
        onReloadError?.(conversationPath, finalCheck, ownsBuffer);
      }
    };

    const applySnapshot = (message: Message) => {
      frameScheduler?.cancel(conversationPath);
      if (!ownsBuffer()) return;
      resumedBuffer.message = message;
      if (!isPathDisplayed(conversationPath)) return;
      setConversation((prev) => {
        if (!prev || !ownsBuffer() || !isPathDisplayed(conversationPath))
          return prev;
        const next = restoreBufferedMessage(prev, resumedBuffer);
        conversationRef.current = next;
        return next;
      });
    };

    const publishBuffer = () =>
      setConversation((prev) => {
        if (!prev || !ownsBuffer() || !isPathDisplayed(conversationPath))
          return prev;
        const next = restoreBufferedMessage(prev, resumedBuffer);
        conversationRef.current = next;
        return next;
      });

    const applyAttachChunk = (chunk: StreamChunk) => {
      if (!ownsBuffer() || isStoppedByUser()) return;
      const updated = applyChunkToMessages([resumedBuffer.message], 0, chunk);
      if (updated) resumedBuffer.message = updated[0];
      if (!isPathDisplayed(conversationPath)) return;
      if (frameScheduler) {
        frameScheduler.schedule(conversationPath, publishBuffer);
        return;
      }
      publishBuffer();
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

      /*
       * The watch only reports updates made after it subscribed, so a
       * generation that finished between the caller's last read and this
       * subscription would otherwise wait out the whole timeout. Events
       * arriving meanwhile stay buffered in the stream.
       */
      try {
        const current = await transport.getConversation(
          safeDecodeURI(currentConversationId),
        );
        if (!isAwaitingGenerationResume(current)) {
          watchController.abort();
          void stream.cancel().catch(() => undefined);
          finish(current);
          return;
        }
      } catch {
        // Keep watching: a later update or the final check resolves it.
      }

      let resolved = false;
      const timeoutId = window.setTimeout(() => {
        watchController.abort();
      }, GENERATION_RESUME_WATCH_TIMEOUT_MS);

      try {
        await readSseEvents<{ action?: string }>(stream, async (event) => {
          if (event?.action !== 'UPDATE') return false;

          try {
            const result = await transport.getConversation(
              safeDecodeURI(currentConversationId),
            );
            if (!isAwaitingGenerationResume(result)) {
              finish(result);
              resolved = true;
              return true;
            }
          } catch {
            // Keep watching until stream ends or timeout.
          }
          return false;
        });
      } finally {
        clearTimeout(timeoutId);
      }

      /*
       * Timed out or the stream ended without a qualifying event: do one
       * last check before giving up, so regenerate/edit become available
       * again either way.
       */
      if (!resolved) await finalCheck();
    };

    /*
     * Attaches to the backend's live replay of the in-flight generation, if
     * one is available. Waits indefinitely for a genuine terminal event —
     * see the note on `GENERATION_RESUME_WATCH_TIMEOUT_MS` above for why no
     * timeout is imposed here. Returns `true` when a terminal event arrived
     * (ending in a `finalCheck`), or `false` when the caller should fall
     * back to `runWatch` (attach couldn't open at all, or its stream ended
     * — e.g. a network drop or backend restart — without ever seeing one).
     */
    const runAttach = async (): Promise<boolean> => {
      const attachController = new AbortController();
      let stream: ReadableStream<Uint8Array>;
      try {
        stream = await transport.attachToGeneration(
          conversationPath,
          attachController.signal,
        );
      } catch {
        return false;
      }

      let sawTerminal = false;
      let persistenceFailed = false;
      await readSseEvents<GenerationAttachEvent>(stream, (event) => {
        if (!ownsBuffer()) return true;
        switch (event.type) {
          case 'snapshot':
            applySnapshot(event.message);
            return false;
          case 'chunk':
            applyAttachChunk(event.chunk);
            return false;
          case 'done':
          case 'error':
          case 'stopped':
            persistenceFailed =
              event.type === 'error' &&
              event.errorType === GenerationPersistenceError.type;
            sawTerminal = true;
            return true;
        }
      });

      if (sawTerminal) {
        if (persistenceFailed) finish(undefined, true);
        else await finalCheck();
        return true;
      }
      return !ownsBuffer();
    };

    /* `finish` has already run (or ownership was lost) by the time either run returns. */
    const resume = async () => {
      try {
        const handled = await runAttach();
        if (!handled) await runWatch();
      } finally {
        options.onSettled?.();
      }
    };
    void resume();
  };
};
