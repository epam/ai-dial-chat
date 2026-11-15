import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import {
  type Conversation,
  type MessageCustomContent,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GENERATION_CONFLICT_MESSAGE,
  DEFAULT_GENERATION_INTERRUPTED_ERROR_MESSAGE,
  DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE,
} from '../create-chat-stream-api';
import { restoreBufferedMessage } from './buffered-generation';
import { getConversationPath } from './conversation-path';
import type {
  StartStreamOptions,
  UseConversationStreamParams,
  UseConversationStreamResult,
} from './conversation-stream.types';
import { createFrameScheduler } from './frame-scheduler';
import {
  createResumeIfAwaitingGeneration,
  isAwaitingGenerationResume,
} from './generation-resume';
import { findResumedBackgroundGenerationId } from './stream-errors';
import { runStreamSession } from './stream-session';
import { useConversationReloadErrors } from './useConversationReloadErrors';
import { useStopGeneration } from './useStopGeneration';
import { useStreamPathState } from './useStreamPathState';

export type {
  ConversationGenerationLifecycle,
  ConversationStateAccessor,
  ConversationStreamChannel,
  ConversationStreamOverlayNotifier,
  ConversationStreamTransport,
  StartStreamOptions,
  StreamCompletionOptions,
  UseConversationStreamParams,
  UseConversationStreamResult,
} from './conversation-stream.types';

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
  generationInterruptedMessage = DEFAULT_GENERATION_INTERRUPTED_ERROR_MESSAGE,
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const {
    reloadFailuresRef,
    reloadFailures,
    retrying,
    clearReloadError,
    reportReloadError,
    retryConversationReload,
  } = useConversationReloadErrors({ conversationId, mountedRef });
  const {
    streamingPaths,
    streamingPathsRef,
    stoppablePaths,
    activeGenerationIdsRef,
    resumedGenerationIdsRef,
    resumingPathsRef,
    bufferedGenerationsRef,
    stoppedGenerationIdsRef,
    stopRequestedIdsRef,
    latestGenerationIdsRef,
    isPathDisplayed,
    addStreamingPath,
    removeStreamingPath,
    setPathStoppable,
    releaseActiveGeneration,
    rememberResumedGenerationId,
    forgetResumedGenerationId,
  } = useStreamPathState({
    conversationId,
    frameScheduler,
    mountedRef,
    clearReloadError,
  });

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
        generationInterruptedMessage,
        frameScheduler: batchChunksPerFrame ? frameScheduler : undefined,
        stoppedGenerationIdsRef,
        rememberResumedGenerationId,
        forgetResumedGenerationId,
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
      generationInterruptedMessage,
      batchChunksPerFrame,
      frameScheduler,
      rememberResumedGenerationId,
      forgetResumedGenerationId,
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
      mode?: SendCompletionDtoModeEnum,
      options?: StartStreamOptions,
    ) =>
      runStreamSession(
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
        },
        currentConversationId,
        userContent,
        messageIndex,
        model,
        customContent,
        generationId,
        mode,
        options,
      ),
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
    [bufferedGenerationsRef, clearReloadError, reloadFailuresRef],
  );

  const handleStop = useStopGeneration({
    conversationId,
    conversationRef,
    transport,
    overlay,
    onStopError,
    frameScheduler,
    mountedRef,
    activeGenerationIdsRef,
    resumedGenerationIdsRef,
    bufferedGenerationsRef,
    stoppedGenerationIdsRef,
    stopRequestedIdsRef,
    streamingPathsRef,
  });

  /*
   * The public entry point takes no caller options; the internal ones are reserved
   * for stream recovery and the conflict handover. Only this entry point asks the
   * resume to take an attach-announced generation id, so those two keep their Stop behavior.
   */
  const resumeIfAwaitingGeneration = useCallback(
    (currentConversationId: string, conversation: Conversation) => {
      /* A load replay (StrictMode, or returning to an in-flight chat) can
         restore our own empty buffer before the first token arrives. The
         local stream already owns that path: attaching would replace its
         buffer and let the resume's early read erase the answer. Internal
         error/conflict recovery still calls resumeGeneration directly. */
      if (
        activeGenerationIdsRef.current.has(
          getConversationPath(currentConversationId),
        )
      )
        return;
      resumeGeneration(currentConversationId, conversation, {
        trackAttachGenerationId: true,
        shouldMarkOrphanedAsInterrupted: true,
      });
    },
    [activeGenerationIdsRef, resumeGeneration],
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
