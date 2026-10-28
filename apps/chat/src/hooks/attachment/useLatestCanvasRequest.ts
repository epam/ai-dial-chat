import type { ShouldCommitCanvas } from '@epam/ai-dial-attachment-canvas';
import { useCallback, useEffect, useRef } from 'react';

/*
 * The app has a single attachment canvas, so "latest" is counted across every
 * caller: a click in the sources panel must supersede a preview still loading
 * from a message, not only another click in the same component.
 */
let latestGeneration = 0;

/**
 * Returns a function that starts a canvas preview request and hands back its
 * `shouldCommit` guard, true only while no later request has started anywhere
 * and the calling component is still mounted. Call it at click time, before
 * `openAttachmentCanvas`, so even a synchronous preview supersedes a pending one.
 */
export const useLatestCanvasRequest = (): (() => ShouldCommitCanvas) => {
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => {
    const generation = (latestGeneration += 1);
    return () => isMountedRef.current && latestGeneration === generation;
  }, []);
};
