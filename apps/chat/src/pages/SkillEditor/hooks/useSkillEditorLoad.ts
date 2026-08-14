import {
  SkillFileNodeKind,
  type SkillEditorValues,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getApiErrorStatus } from '../../../server-api/api-error';
import { downloadSkill } from '../../../server-api/skills.api';
import { SkillEditorLoadState } from '../../../types/skill-editor-load-state';
import { parseSkillManifest, unpackSkillArchive } from '../../../utils/skill';
import type { SkillFileContent } from '../../../utils/skill-file-preview';
import { nameFromPath } from '../utils/skill-file-tree';

interface UseSkillEditorLoadParams {
  isEditMode: boolean;
  bucket: string | undefined;
  skillPath: string | null | undefined;
}

interface UseSkillEditorLoadResult {
  loadState: SkillEditorLoadState;
  loadedValues: SkillEditorValues | undefined;
  setLoadedValues: Dispatch<SetStateAction<SkillEditorValues | undefined>>;
  files: SkillFileTreeNode[];
  setFiles: Dispatch<SetStateAction<SkillFileTreeNode[]>>;
  filesContentRef: React.MutableRefObject<Map<string, SkillFileContent>>;
  frontmatterRef: React.MutableRefObject<Record<string, unknown>>;
  etagRef: React.MutableRefObject<string | undefined>;
  loadedPathRef: React.MutableRefObject<string | undefined>;
  /** Re-attempts the edit-mode download (load-error retry or post-conflict reload). */
  retryLoad: () => void;
}

/**
 * Owns the edit-mode skill download/unpack/parse flow: the in-memory
 * supporting-file map, the loaded manifest values and frontmatter, the
 * concurrency ETag, and the load-state machine driving the form's
 * loading/error/forbidden/not-found presentation. Create mode never leaves
 * `'loaded'` and starts with empty state.
 */
export const useSkillEditorLoad = ({
  isEditMode,
  bucket,
  skillPath,
}: UseSkillEditorLoadParams): UseSkillEditorLoadResult => {
  const [loadState, setLoadState] = useState<SkillEditorLoadState>(
    isEditMode ? SkillEditorLoadState.Loading : SkillEditorLoadState.Loaded,
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadedValues, setLoadedValues] = useState<
    SkillEditorValues | undefined
  >();
  const etagRef = useRef<string | undefined>(undefined);
  const frontmatterRef = useRef<Record<string, unknown>>({});
  const loadedPathRef = useRef<string | undefined>(undefined);

  const [files, setFiles] = useState<SkillFileTreeNode[]>([]);
  const filesContentRef = useRef<Map<string, SkillFileContent>>(new Map());

  useEffect(() => {
    if (!isEditMode || !bucket) return;
    if (skillPath == null) {
      setLoadState(SkillEditorLoadState.Error);
      return;
    }

    let cancelled = false;
    setLoadState(SkillEditorLoadState.Loading);

    (async () => {
      try {
        const response = await downloadSkill(bucket, skillPath);
        const etag = response.headers.get('etag');
        if (!etag) {
          if (!cancelled) setLoadState(SkillEditorLoadState.Error);
          return;
        }
        const buffer = await response.arrayBuffer();
        const { manifestText, files: unpackedFiles } = unpackSkillArchive(
          new Uint8Array(buffer),
        );
        const { frontmatter, instructions } = parseSkillManifest(manifestText);
        if (cancelled) return;

        etagRef.current = etag;
        frontmatterRef.current = frontmatter;
        loadedPathRef.current = skillPath;
        filesContentRef.current = new Map(
          [...unpackedFiles].map(([path, bytes]) => [path, { bytes }]),
        );
        setFiles(
          [...unpackedFiles.keys()].map((path) => ({
            path,
            name: nameFromPath(path),
            kind: SkillFileNodeKind.File,
          })),
        );
        setLoadedValues({
          name: typeof frontmatter.name === 'string' ? frontmatter.name : '',
          description:
            typeof frontmatter.description === 'string'
              ? frontmatter.description
              : '',
          instructions,
        });
        setLoadState(SkillEditorLoadState.Loaded);
      } catch (err) {
        if (cancelled) return;
        const status = getApiErrorStatus(err);
        if (status === 403) setLoadState(SkillEditorLoadState.Forbidden);
        else if (status === 404) setLoadState(SkillEditorLoadState.NotFound);
        else setLoadState(SkillEditorLoadState.Error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, bucket, skillPath, loadAttempt]);

  return {
    loadState,
    loadedValues,
    setLoadedValues,
    files,
    setFiles,
    filesContentRef,
    frontmatterRef,
    etagRef,
    loadedPathRef,
    retryLoad: () => setLoadAttempt((attempt) => attempt + 1),
  };
};
