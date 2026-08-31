import {
  createForbiddenCanvasContent,
  createLoadErrorCanvasContent,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  type SkillFileContent,
  SkillPreviewErrorKind,
  useSkillFilePreview,
} from '@epam/ai-dial-chat-hooks';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { useSkillFilePreviewSync } from '../../hooks/attachment/useSkillFilePreviewSync';
import { SkillFilePreview } from '../SkillFilePreview/SkillFilePreview';

interface Props {
  /** Opaque listing id selected in the catalog file tree. */
  fileId: string;
  /** Basename resolved by the catalog tree. */
  fileName: string;
  /** App-owned loader; backend path knowledge stays outside the catalog lib. */
  onLoadFile: (fileId: string) => Promise<SkillFileContent>;
}

/**
 * Loads one read-only skill file lazily, then feeds it into the exact same
 * attachment-canvas synchronization and body renderer used by Skill Builder.
 */
export const SkillDetailsFilePreview: FC<Props> = ({
  fileId,
  fileName,
  onLoadFile,
}) => {
  const node = useMemo<SkillFileTreeNode>(
    () => ({ path: fileId, name: fileName, kind: SkillFileNodeKind.File }),
    [fileId, fileName],
  );
  const filesContentRef = useRef<Map<string, SkillFileContent>>(new Map());
  const [files, setFiles] = useState<SkillFileTreeNode[]>([node]);
  const { openCanvas } = useAttachmentCanvas();
  const { content, error } = useSkillFilePreview({ fileId, onLoadFile });

  /* Clear the content cache and reset the file list whenever the selection changes. */
  useEffect(() => {
    filesContentRef.current = new Map();
    setFiles([node]);
  }, [node]);

  /* Bridge resolved content into the attachment-canvas sync protocol. */
  useEffect(() => {
    if (content == null) return;
    filesContentRef.current.set(fileId, content);
    /* A new array wakes the shared sync hook after the ref is populated. */
    setFiles([node]);
  }, [content, fileId, node]);

  /* Map classified errors to the canvas overlay. */
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

  useSkillFilePreviewSync({
    selectedPath: fileId,
    files,
    filesContentRef,
  });

  return <SkillFilePreview path={fileId} />;
};
