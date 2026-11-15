import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import {
  type Conversation,
  generateUUID,
  type MessageCustomContent,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import type { MutableRefObject } from 'react';
import { safeDecodeURI } from '../../shared/string-utils';
import {
  GenerationConflictError,
  GenerationPersistenceError,
  StreamInterruptedError,
} from '../create-chat-stream-api';
import { applyChunkToMessages } from './apply-chunk';
import {
  type BufferedGeneration,
  restoreBufferedMessage,
} from './buffered-generation';
import { getConversationPath } from './conversation-path';
import type {
  ConversationGenerationLifecycle,
  ConversationStateAccessor,
  ConversationStreamChannel,
  ConversationStreamOverlayNotifier,
  ConversationStreamTransport,
  StartStreamOptions,
  StreamCompletionOptions,
} from './conversation-stream.types';
import type { FrameScheduler } from './frame-scheduler';
import {
  createResumeIfAwaitingGeneration,
  fetchConversationForRecovery,
  hasGeneratedPayload,
  findPendingBackgroundMessageIndex,
  isAwaitingGenerationResume,
} from './generation-resume';
import {
  CHANNEL_WAIT_TIMEOUT_MS,
  resolveStreamErrorMessage,
  UNAUTHORIZED_STATUS,
} from './stream-errors';
import type { useConversationReloadErrors } from './useConversationReloadErrors';
import type { useStreamPathState } from './useStreamPathState';

type PathState = ReturnType<typeof useStreamPathState>;

type ReloadErrors = ReturnType<typeof useConversationReloadErrors>;

/** Everything a stream session reads from `useConversationStream`: its capabilities, messages, refs and mutators. */
export interface StreamSessionContext {
  transport: ConversationStreamTransport;
  channel: ConversationStreamChannel | undefined;
  overlay: ConversationStreamOverlayNotifier | undefined;
  startGeneration: ConversationGenerationLifecycle['startGeneration'];
  completeGeneration: ConversationGenerationLifecycle['completeGeneration'];
  setConversation: ConversationStateAccessor['setConversation'];
  conversationRef: ConversationStateAccessor['conversationRef'];
  generationConflictMessage: string;
  generationPersistenceErrorMessage: string;
  onStreamErrorRef: MutableRefObject<((error: Error) => void) | undefined>;
  batchChunksPerFrameRef: MutableRefObject<boolean>;
  mountedRef: MutableRefObject<boolean>;
  frameScheduler: FrameScheduler;
  resumeGeneration: ReturnType<typeof createResumeIfAwaitingGeneration>;
  activeGenerationIdsRef: PathState['activeGenerationIdsRef'];
  latestGenerationIdsRef: PathState['latestGenerationIdsRef'];
  resumingPathsRef: PathState['resumingPathsRef'];
  bufferedGenerationsRef: PathState['bufferedGenerationsRef'];
  stoppedGenerationIdsRef: PathState['stoppedGenerationIdsRef'];
  addStreamingPath: PathState['addStreamingPath'];
  removeStreamingPath: PathState['removeStreamingPath'];
  setPathStoppable: PathState['setPathStoppable'];
  releaseActiveGeneration: PathState['releaseActiveGeneration'];
  isPathDisplayed: PathState['isPathDisplayed'];
  reportReloadError: ReloadErrors['reportReloadError'];
  clearReloadError: ReloadErrors['clearReloadError'];
}

/**
 * One generation of `useConversationStream.startStream`: registers the
 * generation for its path, sends the completion, applies chunks (batched per
 * frame when asked), reloads the persisted conversation on completion, shows
 * a failure on the message, recovers an interrupted or conflicted start, and
 * saves an answer whose terminal save was rejected with `401`. Each generation
 * keeps its own closures over its id, path and abort controller; the hook
 * passes a fresh context built from the same values its callback closes over.
 */
export const runStreamSession = (
  {
    transport,
    channel,
    overlay,
    startGeneration,
    completeGeneration,
    setConversation,
    conversationRef,
    generationConflictMessage,
    generationPersistenceErrorMessage,
    onStreamErrorRef,
    batchChunksPerFrameRef,
    mountedRef,
    frameScheduler,
    resumeGeneration,
    activeGenerationIdsRef,
    latestGenerationIdsRef,
    resumingPathsRef,
    bufferedGenerationsRef,
    stoppedGenerationIdsRef,
    addStreamingPath,
    removeStreamingPath,
    setPathStoppable,
    releaseActiveGeneration,
    isPathDisplayed,
    reportReloadError,
    clearReloadError,
  }: StreamSessionContext,
  currentConversationId: string,
  userContent: string,
  messageIndex: number,
  model: string,
  customContent?: MessageCustomContent,
  generationId?: string,
  mode: SendCompletionDtoModeEnum = SendCompletionDtoModeEnum.Append,
  options: StartStreamOptions = {},
): void => {
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
        if (buffered) bufferedGenerationsRef.current.delete(conversationPath);
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
      if (batchChunksPerFrameRef.current && buffered?.generationId === genId) {
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
    const currentBuffer = bufferedGenerationsRef.current.get(conversationPath);
    const buffered =
      currentBuffer?.generationId === genId ? currentBuffer : undefined;
    if (buffered && !(error instanceof GenerationPersistenceError)) {
      bufferedGenerationsRef.current.delete(conversationPath);
    }
    releaseGeneration();
    /*
     * The backend's terminal save holds the credentials captured when this
     * completion started, so a long generation can outlive them and the
     * save is rejected with 401 while this tab's session is still valid
     * ([#9324](https://github.com/epam/ai-dial-chat/issues/9324)). A 401
     * means nothing was stored, so one save from here cannot duplicate a
     * committed write; the warning is shown only if that save fails too.
     * A stopped or failed answer is saved the same way, with the terminal
     * markers the error carries: left as the stored placeholder, it would
     * read as a generation still running after a reload ([#9370](https://github.com/epam/ai-dial-chat/issues/9370)).
     */
    if (
      buffered &&
      transport.saveConversation &&
      error instanceof GenerationPersistenceError &&
      error.status === UNAUTHORIZED_STATUS
    ) {
      void saveUnsavedAnswer(
        error,
        buffered,
        transport.saveConversation.bind(transport),
      );
      return;
    }
    showFailure(error, buffered);
  };

  /* Writes the displayable error text onto the failed generation's message. */
  const showFailure = (
    error: Error,
    buffered: BufferedGeneration | undefined,
  ) => {
    if (buffered && error instanceof GenerationPersistenceError) {
      buffered.message = {
        ...buffered.message,
        streamErrorMessage: generationPersistenceErrorMessage,
      };
    }
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

  /*
   * Saves the received answer once over the stored conversation, then shows
   * the saved copy, or the persistence warning if the read or save fails.
   */
  const saveUnsavedAnswer = async (
    error: GenerationPersistenceError,
    buffered: BufferedGeneration,
    saveConversation: NonNullable<
      ConversationStreamTransport['saveConversation']
    >,
  ) => {
    const isSaveCurrent = () =>
      mountedRef.current &&
      !isSuperseded() &&
      bufferedGenerationsRef.current.get(conversationPath) === buffered;
    try {
      const stored = await transport.getConversation(
        safeDecodeURI(currentConversationId),
      );
      if (!isSaveCurrent()) return;
      /* Same unsaved-placeholder check as `reloadConversation`: any other
       * stored copy is not this turn's start state, so saving over it would
       * rewrite history. */
      if (
        buffered.messageIndex !== stored.messages.length - 1 ||
        !isAwaitingGenerationResume(stored)
      ) {
        showFailure(error, buffered);
        return;
      }
      /* A stopped or failed answer keeps the outcome the rejected write carried. */
      const answer = error.terminalMarker
        ? {
            ...buffered,
            message: { ...buffered.message, ...error.terminalMarker },
          }
        : buffered;
      const saved = await saveConversation(
        conversationPath,
        restoreBufferedMessage(stored, answer),
      );
      if (!isSaveCurrent()) return;
      bufferedGenerationsRef.current.delete(conversationPath);
      if (!isPathDisplayed(conversationPath)) return;
      setConversation(saved);
      conversationRef.current = saved;
    } catch {
      if (isSaveCurrent()) showFailure(error, buffered);
    }
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
  const recoverInterruptedStream = async (error: StreamInterruptedError) => {
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
    const currentBuffer = bufferedGenerationsRef.current.get(conversationPath);
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
          bufferedGenerationsRef.current.get(conversationPath)?.generationId ===
          genId
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
};
