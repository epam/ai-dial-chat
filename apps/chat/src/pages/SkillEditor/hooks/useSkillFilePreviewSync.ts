import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { useEffect } from 'react';
import { useOpenAttachmentCanvas } from '../../../hooks/attachment/useOpenAttachmentCanvas';
import { SKILL_MANIFEST_FILE } from '../../../utils/skill';
import { skillFileToAttachment } from '../../../utils/skill-file-preview';
import type { SkillFileContent } from '../../../utils/skill-file-preview';

interface UseSkillFilePreviewSyncParams {
  selectedPath: string;
  files: SkillFileTreeNode[];
  filesContentRef: React.MutableRefObject<Map<string, SkillFileContent>>;
}

/**
 * Reconciles the shared attachment canvas with the current file-tree
 * selection: opens/replaces the preview for a selected supporting file,
 * closes it for `SKILL.md`/a folder, self-corrects if a slower-resolving
 * earlier selection's content lands after a newer selection already
 * committed, and closes the preview when the Skill Editor unmounts.
 */
export const useSkillFilePreviewSync = ({
  selectedPath,
  files,
  filesContentRef,
}: UseSkillFilePreviewSyncParams): void => {
  const { openAttachmentCanvas } = useOpenAttachmentCanvas();
  const {
    closeCanvas,
    isOpen: isCanvasOpen,
    isLoading: isCanvasLoading,
    attachmentId: canvasAttachmentId,
  } = useAttachmentCanvas();

  useEffect(() => {
    if (selectedPath === SKILL_MANIFEST_FILE) {
      if (isCanvasOpen) closeCanvas();
      return;
    }
    const node = files.find(
      (file) =>
        file.path === selectedPath && file.kind === SkillFileNodeKind.File,
    );
    if (!node) {
      if (isCanvasOpen) closeCanvas();
      return;
    }
    if (
      canvasAttachmentId === selectedPath &&
      (isCanvasLoading || isCanvasOpen)
    ) {
      return;
    }
    const content = filesContentRef.current.get(node.path);
    if (!content) return;

    void openAttachmentCanvas(skillFileToAttachment(node, content), node.path);
  }, [
    selectedPath,
    files,
    filesContentRef,
    canvasAttachmentId,
    isCanvasLoading,
    isCanvasOpen,
    closeCanvas,
    openAttachmentCanvas,
  ]);

  // Close any open preview when leaving the Skill Editor.
  useEffect(() => {
    return () => closeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);
};
