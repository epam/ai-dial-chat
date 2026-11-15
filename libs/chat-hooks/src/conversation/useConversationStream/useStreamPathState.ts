import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type BufferedGeneration } from './buffered-generation';
import { getConversationPath } from './conversation-path';
import type { FrameScheduler } from './frame-scheduler';

interface UseStreamPathStateParams {
  conversationId: string | undefined;
  /* Pending display writes; cancelled when the displayed conversation changes. */
  frameScheduler: FrameScheduler;
  /* Owned by `useConversationStream`: no state write after unmount. */
  mountedRef: MutableRefObject<boolean>;
  /* From `useConversationReloadErrors`: a new stream clears the path's read failure. */
  clearReloadError: (path: string) => void;
}

/**
 * Per-path generation state of `useConversationStream`: which paths are
 * streaming and which offer Stop, and the refs that own each path's local,
 * latest, resumed and stopped generation ids, its live buffered message and
 * its resume reservation, plus the displayed-conversation guard that keeps a
 * stream from writing into a conversation that is no longer shown.
 * `streamingPathsRef` is synced during render so Stop polling reads the
 * latest set.
 */
export const useStreamPathState = ({
  conversationId,
  frameScheduler,
  mountedRef,
  clearReloadError,
}: UseStreamPathStateParams) => {
  /*
   * Paths with an in-flight generation. A Set (not a boolean) so concurrent
   * generations across conversations each track their own streaming state.
   */
  const [streamingPaths, setStreamingPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const streamingPathsRef = useRef(streamingPaths);
  streamingPathsRef.current = streamingPaths;
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
  /*
   * Id an attach `snapshot` announced for a resumed non-background generation,
   * per path. Local and background ids keep precedence in `handleStop`.
   */
  const resumedGenerationIdsRef = useRef<Map<string, string>>(new Map());
  const resumingPathsRef = useRef<Set<string>>(new Set());
  const bufferedGenerationsRef = useRef<Map<string, BufferedGeneration>>(
    new Map(),
  );
  /* Generation ids stopped by the user — onComplete emits notifyStopGenerating's
   * counterpart (nothing) instead of notifyGenerationEnd for these. */
  const stoppedGenerationIdsRef = useRef<Set<string>>(new Set());
  /* Generation ids whose Stop request is outstanding or was accepted: a repeat click sends nothing. */
  const stopRequestedIdsRef = useRef<Set<string>>(new Set());
  /*
   * Newest generation id started for each path — see `isSuperseded` in
   * `startStream`. Chunk staleness is checked against this per-path entry, so
   * concurrent generations in different conversations never drop each other.
   */
  const latestGenerationIdsRef = useRef<Map<string, string>>(new Map());

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
    [mountedRef],
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
   * Stop for a resumed non-background generation. A path with a live local
   * generation already has its own id and Stop, so neither is touched here.
   */
  const rememberResumedGenerationId = useCallback(
    (path: string, generationId: string) => {
      if (activeGenerationIdsRef.current.has(path)) return;
      resumedGenerationIdsRef.current.set(path, generationId);
      setPathStoppable(path, true);
    },
    [setPathStoppable],
  );

  /* Compare-and-clear: a late call from a resume that lost the path cannot erase a newer id. */
  const forgetResumedGenerationId = useCallback(
    (path: string, generationId: string) => {
      if (resumedGenerationIdsRef.current.get(path) !== generationId) return;
      resumedGenerationIdsRef.current.delete(path);
      if (!activeGenerationIdsRef.current.has(path)) {
        setPathStoppable(path, false);
      }
    },
    [setPathStoppable],
  );

  return {
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
  };
};
