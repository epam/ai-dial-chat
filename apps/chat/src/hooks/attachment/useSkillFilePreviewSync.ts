import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { useEffect } from 'react';
import { SKILL_MANIFEST_FILE } from '../../utils/skill';
import { skillFileToAttachment } from '../../utils/skill-file-preview';
import type { SkillFileContent } from '../../utils/skill-file-preview';
import { useOpenAttachmentCanvas } from './useOpenAttachmentCanvas';

interface UseSkillFilePreviewSyncParams {
  selectedPath: string;
  files: SkillFileTreeNode[];
  filesContentRef: React.MutableRefObject<Map<string, SkillFileContent>>;
}

/**
 * Reconciles the shared attachment canvas with a skill file-tree selection.
 * It is shared by Skill Builder and read-only skill details so both surfaces
 * resolve every supporting file through exactly the same preview pipeline.
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

  useEffect(() => {
    return () => closeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);
};
