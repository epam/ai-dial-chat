import { PublishFolderNode } from '@epam/ai-dial-catalog';
import type { ListFilesItemDto } from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFolder, listPublicFiles } from '../../server-api/files.api';
import { safeDecodeURI } from '../../utils/string-utils';

/**
 * Folder paths that deny publish write access under the current heuristic.
 * TODO: replace with a real DIAL Core bucket-permission check once that
 * contract is confirmed (see design.md Open Questions for
 * add-catalog-publish-to-folder).
 */
const RESTRICTED_FOLDER_SEGMENT = 'Production';

const toApiPath = (path: string[]): string | undefined =>
  path.length ? `${path.join('/')}/` : undefined;

const buildFolderNodes = (
  cache: Map<string, ListFilesItemDto[]>,
  apiPath: string,
  parentPath: string[],
): PublishFolderNode[] => {
  const items = cache.get(apiPath);
  if (items == null) {
    return [];
  }
  return items
    .filter((item) => item.nodeType === ListFilesItemDtoNodeTypeEnum.Folder)
    .map((item): PublishFolderNode => {
      const name = safeDecodeURI(item.name);
      const path = [...parentPath, name];
      const childApiPath = `${apiPath}${item.name}/`;
      const children = cache.has(childApiPath)
        ? buildFolderNodes(cache, childApiPath, path)
        : undefined;
      return { path, name, children };
    });
};

/** Result of {@link usePublishFolders}. */
export interface UsePublishFoldersResult {
  /** Folder tree loaded so far from the Organization/public bucket. */
  folderItems: PublishFolderNode[];
  /** Folder path keys (`path.join('/')`) currently expanded in the tree. */
  expandedPaths: Set<string>;
  /** Folder path keys whose children have already been fetched. */
  loadedPaths: Set<string>;
  /** Folder path keys currently being fetched. */
  loadingPaths: Set<string>;
  /** Called by the folder tree when the set of expanded folders changes. */
  onExpandedPathsChange: (paths: Set<string>) => void;
  /** Creates a folder under `parentPath` in the Organization/public bucket. */
  onCreatePublishFolder: (parentPath: string[], name: string) => Promise<void>;
  /** Heuristic write-access check for a folder path (see the TODO above). */
  hasPublishWriteAccess: (folderPath: string[]) => boolean;
}

/**
 * Loads the Organization/public bucket's folder tree lazily (one API call
 * per expanded folder, cached by API path) for the Publish flow's folder
 * picker — shared by catalog entity publish and conversation publish (see
 * design.md D5). Scoped to folders only — unlike `useDialFileManager`, it
 * does not list files, rename, copy/move, or upload (see design.md D2 of
 * `add-catalog-publish-to-folder`).
 */
export const usePublishFolders = (): UsePublishFoldersResult => {
  const [cache, setCache] = useState<Map<string, ListFilesItemDto[]>>(
    () => new Map(),
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(
    () => new Set(),
  );

  const loadedPaths = useMemo(() => {
    const result = new Set<string>();
    expandedPaths.forEach((pathKey) => {
      const apiPath = pathKey ? `${pathKey}/` : '';
      if (cache.has(apiPath)) {
        result.add(pathKey);
      }
    });
    return result;
  }, [expandedPaths, cache]);

  const fetchFolder = useCallback(async (apiPath: string) => {
    setLoadingPaths((prev) => new Set(prev).add(apiPath));
    try {
      const { items } = await listPublicFiles({ path: apiPath || undefined });
      setCache((prev) => new Map(prev).set(apiPath, items));
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(apiPath);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    void fetchFolder('');
    // Root folder is fetched once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onExpandedPathsChange = useCallback(
    (nextExpandedPaths: Set<string>) => {
      setExpandedPaths(nextExpandedPaths);
      nextExpandedPaths.forEach((pathKey) => {
        const apiPath = `${pathKey}/`;
        if (!cache.has(apiPath) && !loadingPaths.has(apiPath)) {
          void fetchFolder(apiPath);
        }
      });
    },
    [cache, loadingPaths, fetchFolder],
  );

  const onCreatePublishFolder = useCallback(
    async (parentPath: string[], name: string) => {
      const parentApiPath = toApiPath(parentPath) ?? '';
      const parentItems = cache.get(parentApiPath) ?? [];
      const parentBucket = parentItems[0]?.bucket ?? cache.get('')?.[0]?.bucket;
      if (parentBucket == null) {
        throw new Error('Cannot create folder: parent bucket is unknown');
      }
      const created = await createFolder({
        bucket: parentBucket,
        parentPath: toApiPath(parentPath),
        name,
      });
      setCache((prev) => {
        const next = new Map(prev);
        const folderItem: ListFilesItemDto = {
          name: created.name,
          path: created.path,
          folderId: created.folderId,
          nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
          bucket: created.bucket,
          parentPath: created.parentPath || undefined,
        };
        next.set(parentApiPath, [
          ...(next.get(parentApiPath) ?? []),
          folderItem,
        ]);
        return next;
      });
    },
    [cache],
  );

  const hasPublishWriteAccess = useCallback(
    (folderPath: string[]) => !folderPath.includes(RESTRICTED_FOLDER_SEGMENT),
    [],
  );

  const folderItems = useMemo(() => buildFolderNodes(cache, '', []), [cache]);

  return {
    folderItems,
    expandedPaths,
    loadedPaths,
    loadingPaths,
    onExpandedPathsChange,
    onCreatePublishFolder,
    hasPublishWriteAccess,
  };
};
