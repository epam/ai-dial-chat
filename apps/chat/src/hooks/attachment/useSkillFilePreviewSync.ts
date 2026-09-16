import {
  useAttachmentCanvas,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  skillFileToAttachment,
  type SkillFileContent,
} from '@epam/ai-dial-chat-hooks/skill-editor';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SkillFilePreviewState } from '../../types/skill-file-preview';
import { useAttachmentCanvasResolvers } from './useAttachmentCanvasResolvers';

interface UseSkillFilePreviewSyncParams {
  /** The file tree's current selection, `SKILL.md` for the manifest view. */
  selectedPath: string;
  /**
   * Resource-scoped key identifying the current selection in the shared
   * canvas, or `undefined` while the manifest view is shown. The host derives
   * it from the edited resource so the same relative path in another skill or
   * bucket is never mistaken for this one.
   */
  canvasAttachmentId: string | undefined;
  files: SkillFileTreeNode[];
  filesContentRef: React.MutableRefObject<Map<string, SkillFileContent>>;
}

interface UseSkillFilePreviewSyncResult {
  /** Explicit presentation state for the currently selected file. */
  state: SkillFilePreviewState;
  /** Re-runs the open for the current selection, clearing its failure first. */
  retry: () => void;
}

/**
 * Reconciles the shared attachment canvas with Skill Builder's file-tree
 * selection. Read-only skill details use their own isolated canvas state.
 */
export const useSkillFilePreviewSync = ({
  selectedPath,
  canvasAttachmentId,
  files,
  filesContentRef,
}: UseSkillFilePreviewSyncParams): UseSkillFilePreviewSyncResult => {
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const {
    closeCanvas,
    isOpen: isCanvasOpen,
    isLoading: isCanvasLoading,
    attachmentId: currentCanvasId,
  } = useAttachmentCanvas();

  const [failedId, setFailedId] = useState<string | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);

  /*
   * Requests are numbered monotonically, and only the newest may write canvas
   * state. An id comparison alone is not enough: selecting A, then B, then A
   * again makes the first A's id current once more, so its late completion
   * would be judged fresh and would publish content resolved from a superseded
   * request. The counter is also what makes "this editor no longer owns the
   * canvas" expressible — after unmount nothing here is ever the newest again.
   */
  const generationRef = useRef(0);
  /*
   * The id of the open currently in flight. Committing a failure closes the
   * canvas, which re-runs this effect before the failure has been recorded —
   * without this the effect would immediately reopen the same file and the
   * error state could never settle.
   */
  const inFlightIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      /* Retires every in-flight request, so a completion arriving after this
         editor is gone cannot touch whatever owns the canvas next. */
      generationRef.current += 1;
    };
  }, []);

  /*
   * Issues one open and records its outcome. Errors are handled here, so the
   * reconciliation effect fires it and does not await it.
   */
  const openPreview = useCallback(
    async (
      node: SkillFileTreeNode,
      content: SkillFileContent,
      openedId: string,
    ) => {
      const generation = (generationRef.current += 1);
      let opened = false;
      try {
        opened = await openAttachmentCanvas(
          skillFileToAttachment(node, content),
          openedId,
          () => isMountedRef.current && generationRef.current === generation,
        );
      } catch {
        opened = false;
      }

      /* A superseded request reports nothing: it neither displayed content nor
         failed, and its own failure would be attributed to a file the user has
         already moved away from. */
      if (!isMountedRef.current || generationRef.current !== generation) return;
      inFlightIdRef.current = undefined;
      if (!opened) setFailedId(openedId);
    },
    [openAttachmentCanvas],
  );

  useEffect(() => {
    const node =
      canvasAttachmentId == null
        ? undefined
        : files.find(
            (file) =>
              file.path === selectedPath &&
              file.kind === SkillFileNodeKind.File,
          );

    /* The manifest view, a folder node, or a node whose bytes are gone. */
    if (node == null) {
      generationRef.current += 1;
      inFlightIdRef.current = undefined;
      if (isCanvasOpen || isCanvasLoading) closeCanvas();
      return;
    }
    if (
      currentCanvasId === canvasAttachmentId &&
      (isCanvasLoading || isCanvasOpen)
    ) {
      return;
    }
    /* A recorded failure is cleared by a new selection or by `retry`, never by
       re-running this effect — otherwise a failing file would reopen in a
       loop. */
    if (failedId === canvasAttachmentId) return;
    if (inFlightIdRef.current === canvasAttachmentId) return;

    /*
     * Every writer fills `filesContentRef` before it publishes the node in
     * `files` (`useSkillFileActions`'s upload, `useSkillEditorLoad`'s unpack),
     * and a removal drops the node from `files` too — which the `node == null`
     * branch above handles. A File node without bytes is therefore not
     * reachable, and is deliberately left as a quiet no-op rather than an error
     * state: the only way it could occur is a transient frame, which an error
     * state would make permanent.
     */
    const content = filesContentRef.current.get(node.path);
    if (!content) return;

    const openedId = canvasAttachmentId as string;
    inFlightIdRef.current = openedId;
    void openPreview(node, content, openedId);
  }, [
    selectedPath,
    canvasAttachmentId,
    files,
    filesContentRef,
    currentCanvasId,
    isCanvasLoading,
    isCanvasOpen,
    failedId,
    retryCount,
    closeCanvas,
    openPreview,
  ]);

  /* A failure belongs to the file that produced it and must not outlive it. */
  useEffect(() => {
    setFailedId((previous) =>
      previous != null && previous !== canvasAttachmentId
        ? undefined
        : previous,
    );
  }, [canvasAttachmentId]);

  useEffect(() => {
    return () => closeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);

  const retry = useCallback(() => {
    setFailedId(undefined);
    setRetryCount((count) => count + 1);
  }, []);

  const getState = (): SkillFilePreviewState => {
    if (canvasAttachmentId != null && failedId === canvasAttachmentId) {
      return SkillFilePreviewState.Error;
    }
    if (
      canvasAttachmentId != null &&
      currentCanvasId === canvasAttachmentId &&
      isCanvasOpen &&
      !isCanvasLoading
    ) {
      return SkillFilePreviewState.Ready;
    }
    return SkillFilePreviewState.Loading;
  };

  return { state: getState(), retry };
};
