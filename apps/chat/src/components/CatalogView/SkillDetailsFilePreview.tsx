import {
  AttachmentCanvasProvider,
  createForbiddenCanvasContent,
  createLoadErrorCanvasContent,
  useAttachmentCanvas,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  type SkillFileContent,
  SkillPreviewErrorKind,
  skillFileToAttachment,
  useSkillFilePreview,
} from '@epam/ai-dial-chat-hooks';
import { SkillFileNodeKind } from '@epam/ai-dial-skill-editor';
import { type FC, useEffect } from 'react';
import { useAttachmentCanvasResolvers } from '../../hooks/attachment/useAttachmentCanvasResolvers';
import { SkillFilePreviewState } from '../../types/skill-file-preview';
import { SkillFilePreview } from '../SkillFilePreview/SkillFilePreview';

interface Props {
  /** Opaque listing id selected in the catalog file tree. */
  fileId: string;
  /** Basename resolved by the catalog tree. */
  fileName: string;
  /** App-owned loader; backend path knowledge stays outside the catalog lib. */
  onLoadFile: (fileId: string) => Promise<SkillFileContent>;
}

const FilePreviewContent: FC<Props> = ({ fileId, fileName, onLoadFile }) => {
  const {
    openCanvas,
    attachmentId,
    isLoading: isCanvasLoading,
  } = useAttachmentCanvas();
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, {
    customVisualizers: options.customVisualizers,
    themeId: options.themeId,
  });
  const { content, error } = useSkillFilePreview({ fileId, onLoadFile });

  useEffect(() => {
    if (content == null) return;
    const node = { path: fileId, name: fileName, kind: SkillFileNodeKind.File };
    void openAttachmentCanvas(skillFileToAttachment(node, content), fileId);
  }, [content, fileId, fileName, openAttachmentCanvas]);

  useEffect(() => {
    if (error == null) return;
    openCanvas(
      error === SkillPreviewErrorKind.Forbidden
        ? createForbiddenCanvasContent()
        : createLoadErrorCanvasContent(),
      fileName,
      fileId,
    );
  }, [error, fileName, fileId, openCanvas]);

  /*
   * This path surfaces `useSkillFilePreview`'s own failures as canvas content
   * (forbidden/load error) inside its isolated provider, so it passes no retry
   * control. It does not use the preview's Error state: a resolver that finds
   * nothing to display still closes the canvas here and leaves a spinner.
   * Giving the catalog the Skill Editor's recoverable failure is a separate
   * change — a Non-Goal of
   * `openspec/changes/archive/2026-09-16-fix-skill-preview-back-navigation-and-recovery/design.md`.
   */
  return (
    <SkillFilePreview
      state={
        attachmentId === fileId && !isCanvasLoading
          ? SkillFilePreviewState.Ready
          : SkillFilePreviewState.Loading
      }
    />
  );
};

/**
 * Keeps the inline preview independent of the page's attachment panel. Each
 * selection owns its loading and canvas state, so late results cannot replace
 * another file's preview or reopen the page panel after details are closed.
 */
export const SkillDetailsFilePreview: FC<Props> = (props) => (
  <AttachmentCanvasProvider key={props.fileId}>
    <FilePreviewContent {...props} />
  </AttachmentCanvasProvider>
);
