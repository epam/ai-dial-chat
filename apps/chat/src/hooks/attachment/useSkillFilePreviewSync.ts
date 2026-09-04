import {
  useAttachmentCanvas,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  SKILL_MANIFEST_FILE,
  skillFileToAttachment,
  type SkillFileContent,
} from '@epam/ai-dial-chat-hooks/skill-editor';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { useEffect } from 'react';
import { useAttachmentCanvasResolvers } from './useAttachmentCanvasResolvers';

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
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
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
