import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import {
  type Conversation,
  type MessageCustomContent,
  type StreamChunk,
} from '@epam/ai-dial-chat-shared';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

/*
 * Public types of `useConversationStream`: the host-owned capabilities it is
 * driven through (transport, generation lifecycle, client channel, overlay
 * notifier, state accessor), its params and options, and its result.
 * Re-exported from `useConversationStream.ts`, so the package entry points
 * expose them unchanged.
 */

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
  /**
   * Saves `conversation` at the bucket-stripped `path`, resolving with the saved
   * conversation. Used only for the single recovery save after the backend's
   * terminal save was rejected with `401`; without it that failure shows the
   * persistence warning immediately.
   */
  saveConversation?(
    path: string,
    conversation: Conversation,
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
