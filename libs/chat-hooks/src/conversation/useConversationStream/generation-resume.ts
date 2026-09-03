import {
  type Conversation,
  MessageRole,
  type Message,
  type StreamChunk,
} from '@epam/ai-dial-chat-shared';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { safeDecodeURI } from '../../shared/string-utils';
import { applyChunkToMessages } from './apply-chunk';
import {
  type BufferedGeneration,
  restoreBufferedMessage,
} from './buffered-generation';
import { getConversationPath } from './conversation-path';
import type { ConversationStreamTransport } from './useConversationStream';

/**
 * True when the conversation's last message is an unresolved assistant
 * placeholder: the backend only persists a conversation at generation start
 * (empty placeholder) and at generation end (final content, or a partial
 * flagged `streamErrorMessage`/`wasStoppedByUser`), so this shape means a
 * generation was still active elsewhere when the conversation was loaded.
 */
export const isAwaitingGenerationResume = (
  conversation: Conversation,
): boolean => {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  return (
    !!lastMessage &&
    lastMessage.role === MessageRole.Assistant &&
    !lastMessage.content &&
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
 * such as a multi-stage agent/Deep Research run (Issue #8494).
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

/** One event on the `attachToGeneration` SSE stream (`generation-live-replay`). */
type GenerationAttachEvent =
  | { type: 'snapshot'; message: Message }
  | { type: 'chunk'; chunk: StreamChunk }
  | { type: 'done' }
  | { type: 'error'; message?: string }
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
}: ResumeIfAwaitingGenerationDeps) => {
  return (currentConversationId: string, conversation: Conversation): void => {
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
      await readSseEvents<GenerationAttachEvent>(stream, (event) => {
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
            sawTerminal = true;
            return true;
        }
      });

      if (sawTerminal) {
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
  };
};
