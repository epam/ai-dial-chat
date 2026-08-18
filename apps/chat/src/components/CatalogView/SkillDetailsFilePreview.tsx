import {
  createForbiddenCanvasContent,
  createLoadErrorCanvasContent,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { useSkillFilePreviewSync } from '../../hooks/attachment/useSkillFilePreviewSync';
import type { SkillFileContent } from '../../utils/skill-file-preview';
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

  useEffect(() => {
    let cancelled = false;
    filesContentRef.current = new Map();
    setFiles([node]);

    const load = async () => {
      try {
        const content = await onLoadFile(fileId);
        if (cancelled) return;

        filesContentRef.current.set(fileId, content);
        /* A new array wakes the shared sync hook after the ref is populated. */
        setFiles([node]);
      } catch (error) {
        if (cancelled) return;
        const status = (error as { status?: number }).status;
        openCanvas(
          status === 403
            ? createForbiddenCanvasContent()
            : createLoadErrorCanvasContent(),
          fileName,
          fileId,
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [fileId, fileName, node, onLoadFile, openCanvas]);

  useSkillFilePreviewSync({
    selectedPath: fileId,
    files,
    filesContentRef,
  });

  return <SkillFilePreview path={fileId} />;
};
