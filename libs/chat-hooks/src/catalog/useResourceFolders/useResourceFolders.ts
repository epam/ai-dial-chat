import type { ResourceFoldersResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  fromFolderPathKey,
  mergeFolderPaths,
  toFolderPathKey,
  type PublishFolderNode,
} from '@epam/ai-dial-publish-panel';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Parameters for {@link useResourceFolders}. */
export interface UseResourceFoldersParams {
  /** Lists the folders directly under a plain-text folder path; `''` is the root. */
  listFolders: (path: string) => Promise<ResourceFoldersResponseDto>;
  /** Whether to load at all; the root is fetched the first time this is `true`. Defaults to `true`. */
  isEnabled?: boolean;
}

/** Result returned by {@link useResourceFolders}. */
export interface UseResourceFoldersResult {
  /** Folder tree loaded so far, plus folders created locally this session. */
  folderItems: PublishFolderNode[];
  /** Folder path keys currently expanded. */
  expandedPaths: Set<string>;
  /** Folder path keys currently being fetched. */
  loadingPaths: Set<string>;
  /** Called by the folder tree when the expanded folders change; fetches newly expanded ones. */
  onExpandedPathsChange: (paths: Set<string>) => void;
  /** Adds a folder under `parentPath` to the in-memory tree only; it is never created on the backend. */
  onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
  /** Whether the last fetch of any folder failed. */
  hasError: boolean;
  /** Re-fetches every folder whose last fetch failed. */
  retry: () => void;
}

const buildNodes = (
  cache: Map<string, ResourceFoldersResponseDto['folders']>,
  pathKey: string,
): PublishFolderNode[] =>
  (cache.get(pathKey) ?? []).map((folder) => ({
    path: fromFolderPathKey(folder.path),
    name: folder.name,
    children: cache.has(folder.path)
      ? buildNodes(cache, folder.path)
      : undefined,
  }));

/**
 * Lazily loads one resource type's personal folder tree, one listing per
 * expanded folder, for a destination picker. The listing operation is passed
 * in already bound to the host's client, so the hook knows no endpoint.
 */
export const useResourceFolders = ({
  listFolders,
  isEnabled = true,
}: UseResourceFoldersParams): UseResourceFoldersResult => {
  /* Listings keyed by plain folder path key; `''` is the root. */
  const [cache, setCache] = useState<
    Map<string, ResourceFoldersResponseDto['folders']>
  >(() => new Map());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [failedPaths, setFailedPaths] = useState<Set<string>>(() => new Set());
  /* Kept apart from the listing cache, so a listing landing later cannot drop them. */
  const [createdFolderKeys, setCreatedFolderKeys] = useState<string[]>([]);

  const fetchFolder = useCallback(
    async (pathKey: string) => {
      setLoadingPaths((prev) => new Set(prev).add(pathKey));
      setFailedPaths((prev) => {
        const next = new Set(prev);
        next.delete(pathKey);
        return next;
      });
      try {
        const { folders } = await listFolders(pathKey);
        setCache((prev) => new Map(prev).set(pathKey, folders));
      } catch {
        setFailedPaths((prev) => new Set(prev).add(pathKey));
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(pathKey);
          return next;
        });
      }
    },
    [listFolders],
  );

  const [hasRequestedRoot, setHasRequestedRoot] = useState(false);
  useEffect(() => {
    if (!isEnabled || hasRequestedRoot) return;
    setHasRequestedRoot(true);
    void fetchFolder('');
  }, [isEnabled, hasRequestedRoot, fetchFolder]);

  const onExpandedPathsChange = useCallback(
    (nextExpandedPaths: Set<string>) => {
      setExpandedPaths(nextExpandedPaths);
      nextExpandedPaths.forEach((pathKey) => {
        if (!cache.has(pathKey) && !loadingPaths.has(pathKey)) {
          void fetchFolder(pathKey);
        }
      });
    },
    [cache, loadingPaths, fetchFolder],
  );

  const onCreateFolder = useCallback(
    (parentPath: string[], name: string): Promise<void> => {
      const folderKey = toFolderPathKey([...parentPath, name]);
      setCreatedFolderKeys((prev) =>
        prev.includes(folderKey) ? prev : [...prev, folderKey],
      );
      return Promise.resolve();
    },
    [],
  );

  const retry = useCallback(() => {
    failedPaths.forEach((pathKey) => void fetchFolder(pathKey));
  }, [failedPaths, fetchFolder]);

  const folderItems = useMemo(
    () =>
      mergeFolderPaths(
        buildNodes(cache, ''),
        createdFolderKeys.map(fromFolderPathKey),
      ),
    [cache, createdFolderKeys],
  );

  return {
    folderItems,
    expandedPaths,
    loadingPaths,
    onExpandedPathsChange,
    onCreateFolder,
    hasError: failedPaths.size > 0,
    retry,
  };
};
