import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import {
  SkillFileNodeKind,
  type SkillEditorValues,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getApiErrorStatus } from '../../../server-api/api-error';
import {
  downloadSkill,
  downloadSkillFile,
  listSkillFiles,
} from '../../../server-api/skills.api';
import { SkillEditorLoadState } from '../../../types/skill-editor-load-state';
import {
  parseSkillManifest,
  SKILL_MANIFEST_FILE,
  unpackSkillArchive,
} from '../../../utils/skill';
import type { SkillFileContent } from '../../../utils/skill-file-preview';
import { nameFromPath } from '../utils/skill-file-tree';

interface LoadedSkill {
  etag: string;
  manifestText: string;
  files: Map<string, Uint8Array>;
}

class InvalidSkillArchiveError extends Error {}

const resolveSkillFilePath = (
  item: SkillMetadataItemDto,
  skillPath: string,
): string | null => {
  const parentPath = item.parentPath?.replace(/^\/+|\/+$/g, '') ?? '';
  const filesRoot = `${skillPath.replace(/\/+$/g, '')}/files`;

  if (parentPath === filesRoot) return item.name;
  if (parentPath.startsWith(`${filesRoot}/`)) {
    return `${parentPath.slice(filesRoot.length + 1)}/${item.name}`;
  }

  /* Some Core versions return file-relative metadata instead. */
  if (parentPath === 'files') return item.name;
  if (parentPath.startsWith('files/')) {
    return `${parentPath.slice('files/'.length)}/${item.name}`;
  }

  return null;
};

const loadSkillArchive = async (
  bucket: string,
  skillPath: string,
): Promise<LoadedSkill> => {
  const response = await downloadSkill(bucket, skillPath);
  const etag = response.headers.get('etag');
  if (!etag) throw new InvalidSkillArchiveError('Skill ETag is missing');

  try {
    const buffer = await response.arrayBuffer();
    const { manifestText, files } = unpackSkillArchive(new Uint8Array(buffer));
    return { etag, manifestText, files };
  } catch {
    throw new InvalidSkillArchiveError('Skill ZIP is invalid');
  }
};

const loadSkillFiles = async (
  bucket: string,
  skillPath: string,
): Promise<LoadedSkill> => {
  const [manifestResponse, listing] = await Promise.all([
    downloadSkillFile(bucket, skillPath, SKILL_MANIFEST_FILE),
    listSkillFiles({
      bucket,
      path: skillPath,
      filePath: '',
      recursive: true,
    }),
  ]);
  const manifestItem = listing.items.find(
    (item) =>
      item.nodeType === 'item' &&
      resolveSkillFilePath(item, skillPath) === SKILL_MANIFEST_FILE,
  );
  const etag = manifestResponse.headers.get('etag') ?? manifestItem?.etag;
  if (!etag) throw new Error('Skill ETag is missing');

  const fileItems = listing.items
    .filter((item) => item.nodeType === 'item')
    .map((item) => ({ item, path: resolveSkillFilePath(item, skillPath) }))
    .filter(
      (entry): entry is { item: SkillMetadataItemDto; path: string } =>
        entry.path != null && entry.path !== SKILL_MANIFEST_FILE,
    );
  const downloadedFiles = await Promise.all(
    fileItems.map(async ({ path }) => {
      const response = await downloadSkillFile(bucket, skillPath, path);
      return [path, new Uint8Array(await response.arrayBuffer())] as const;
    }),
  );

  return {
    etag,
    manifestText: await manifestResponse.text(),
    files: new Map(downloadedFiles),
  };
};

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
      /*
       * Let StrictMode finish its development-only setup → cleanup → setup
       * cycle before opening a streaming HTTP response. Aborting that first
       * stream can make Vite's dev proxy write to an already-ended response.
       */
      await Promise.resolve();
      if (cancelled) return;

      try {
        let loadedSkill: LoadedSkill;
        try {
          loadedSkill = await loadSkillArchive(bucket, skillPath);
        } catch (error) {
          const status = getApiErrorStatus(error);
          if (!(error instanceof InvalidSkillArchiveError) && status !== 400) {
            throw error;
          }
          /*
           * Core installations differ in whole-skill ZIP behavior. The same
           * manifest/file endpoints used by Catalog details are the
           * compatibility path when the ZIP route resolves the skill as a
           * grouping folder or returns an unusable archive.
           */
          loadedSkill = await loadSkillFiles(bucket, skillPath);
        }
        const { frontmatter, instructions } = parseSkillManifest(
          loadedSkill.manifestText,
        );
        if (cancelled) return;

        etagRef.current = loadedSkill.etag;
        frontmatterRef.current = frontmatter;
        loadedPathRef.current = skillPath;
        filesContentRef.current = new Map(
          [...loadedSkill.files].map(([path, bytes]) => [path, { bytes }]),
        );
        setFiles(
          [...loadedSkill.files.keys()].map((path) => ({
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
