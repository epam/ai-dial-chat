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
  const { openCanvas } = useAttachmentCanvas();
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

  return <SkillFilePreview path={fileId} />;
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
