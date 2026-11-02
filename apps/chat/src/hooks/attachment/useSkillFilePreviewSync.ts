import {
  useAttachmentCanvas,
  useLatestCanvasRequest,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  useSkillFilePreviewSyncController,
  type SkillFileContent,
} from '@epam/ai-dial-chat-hooks/skill-editor';
import { SkillFilePreviewState } from '@epam/ai-dial-chat-hooks/skill-editor';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { useCallback } from 'react';
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
  /** How many times the selected file's bytes were replaced in place; a change reopens its preview. Defaults to `0`. */
  contentRevision?: number;
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
  contentRevision = 0,
}: UseSkillFilePreviewSyncParams): UseSkillFilePreviewSyncResult => {
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const {
    closeCanvas,
    isOpen: isCanvasOpen,
    isLoading: isCanvasLoading,
    attachmentId: currentCanvasId,
  } = useAttachmentCanvas();

  const beginRequest = useLatestCanvasRequest();
  const node =
    canvasAttachmentId == null
      ? undefined
      : files.find(
          (file) =>
            file.path === selectedPath && file.kind === SkillFileNodeKind.File,
        );
  const getContent = useCallback(
    () => (node ? filesContentRef.current.get(node.path) : undefined),
    [node, filesContentRef],
  );
  const result = useSkillFilePreviewSyncController({
    node,
    getContent,
    canvasAttachmentId,
    contentRevision,
    currentCanvasId,
    isCanvasOpen,
    isCanvasLoading,
    beginRequest,
    openAttachmentCanvas,
    closeCanvas,
  });
  return {
    ...result,
    state:
      result.state === SkillFilePreviewState.Idle
        ? SkillFilePreviewState.Loading
        : result.state,
  };
};
