import { type MutableRefObject, useCallback } from 'react';
import { StopCompletionError } from '../create-chat-stream-api';
import { getConversationPath } from './conversation-path';
import type {
  ConversationStateAccessor,
  ConversationStreamOverlayNotifier,
  ConversationStreamTransport,
} from './conversation-stream.types';
import type { FrameScheduler } from './frame-scheduler';
import {
  findResumedBackgroundGenerationId,
  NOT_FOUND_STATUS,
  STOP_NOT_FOUND_GRACE_MS,
  STOP_NOT_FOUND_POLL_MS,
} from './stream-errors';
import type { useStreamPathState } from './useStreamPathState';

type PathState = ReturnType<typeof useStreamPathState>;

interface UseStopGenerationParams {
  conversationId: string | undefined;
  conversationRef: ConversationStateAccessor['conversationRef'];
  transport: ConversationStreamTransport;
  overlay: ConversationStreamOverlayNotifier | undefined;
  onStopError: ((error: Error) => void) | undefined;
  frameScheduler: FrameScheduler;
  /* Owned by `useConversationStream`: no state write after unmount. */
  mountedRef: MutableRefObject<boolean>;
  activeGenerationIdsRef: PathState['activeGenerationIdsRef'];
  resumedGenerationIdsRef: PathState['resumedGenerationIdsRef'];
  bufferedGenerationsRef: PathState['bufferedGenerationsRef'];
  stoppedGenerationIdsRef: PathState['stoppedGenerationIdsRef'];
  stopRequestedIdsRef: PathState['stopRequestedIdsRef'];
  streamingPathsRef: PathState['streamingPathsRef'];
}

/**
 * Stop for the displayed conversation's generation: resolves its id (local,
 * then a pending background generation, then a resumed one), flushes pending
 * display writes, and asks the backend to stop it. A `404` within a short
 * grace window is the generation ending on its own and is not reported.
 */
export const useStopGeneration = ({
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
}: UseStopGenerationParams) => {
  const handleStop = useCallback(() => {
    if (!conversationId) return;
    const conversationPath = getConversationPath(conversationId);
    const localGenId = activeGenerationIdsRef.current.get(conversationPath);
    /*
     * A generation resumed after a refresh has no local id; a background
     * message carries its own, and a non-background one is announced by the
     * attach snapshot, so Stop still reaches the backend for both.
     */
    const genId =
      localGenId ??
      findResumedBackgroundGenerationId(conversationRef.current) ??
      resumedGenerationIdsRef.current.get(conversationPath);
    if (!genId || stopRequestedIdsRef.current.has(genId)) return;

    stopRequestedIdsRef.current.add(genId);
    stoppedGenerationIdsRef.current.add(genId);
    frameScheduler.flush(conversationPath);
    overlay?.notifyStopGenerating?.();
    const content =
      bufferedGenerationsRef.current.get(conversationPath)?.message.content;

    const isGenerationLive = () =>
      activeGenerationIdsRef.current.get(conversationPath) === genId ||
      (localGenId == null && streamingPathsRef.current.has(conversationPath));

    /* Resolves true once the generation has ended locally, false if it is still live after the grace window. */
    const hasGenerationEnded = async (): Promise<boolean> => {
      const attempts = STOP_NOT_FOUND_GRACE_MS / STOP_NOT_FOUND_POLL_MS;
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (!isGenerationLive() || !mountedRef.current) return true;
        await new Promise((resolve) =>
          setTimeout(resolve, STOP_NOT_FOUND_POLL_MS),
        );
      }
      return !isGenerationLive();
    };

    /*
     * Only signal the backend; it aborts upstream, saves the partial, and closes
     * the stream. Keeping our fetch open lets onComplete reload the saved partial
     * race-free (do not reload here — it would race the backend save). A 404 means
     * nothing was left to stop: benign when the generation ends here too, a real
     * failure (e.g. another instance runs it) when it keeps going.
     */
    const sendStop = async () => {
      try {
        await transport.stopCompletion({
          generationId: genId,
          path: conversationPath,
          content,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const isNotFound =
          error instanceof StopCompletionError &&
          error.status === NOT_FOUND_STATUS;
        if (isNotFound && (await hasGenerationEnded())) return;
        stopRequestedIdsRef.current.delete(genId);
        onStopError?.(error);
      }
    };
    void sendStop();
  }, [
    activeGenerationIdsRef,
    bufferedGenerationsRef,
    conversationId,
    conversationRef,
    frameScheduler,
    mountedRef,
    onStopError,
    overlay,
    resumedGenerationIdsRef,
    stopRequestedIdsRef,
    stoppedGenerationIdsRef,
    streamingPathsRef,
    transport,
  ]);

  return handleStop;
};
