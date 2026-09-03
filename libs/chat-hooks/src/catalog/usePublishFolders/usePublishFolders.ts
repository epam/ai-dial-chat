import type {
  ListFilesItemDto,
  ListFilesResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/ai-dial-chat-api-client';
import {
  fromFolderPathKey,
  mergeFolderPaths,
  toFolderPathKey,
  type PublishFolderNode,
} from '@epam/ai-dial-publish-panel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeDecodeURI } from '../../shared/string-utils';

/**
 * Folder paths that deny publish write access under the current heuristic.
 * TODO: replace with a real DIAL Core bucket-permission check once that
 * contract is confirmed.
 */
const RESTRICTED_FOLDER_SEGMENT = 'Production';

/**
 * Upper bound on remembered publish destinations, so the stored list cannot
 * grow without limit; the oldest entry is dropped once it is reached.
 */
const MAX_REMEMBERED_FOLDERS = 50;

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

/** Parameters for {@link usePublishFolders}. */
export interface UsePublishFoldersParams {
  /** Lists one folder level of the Organization/public files bucket. */
  listPublicFiles: (params: { path?: string }) => Promise<ListFilesResponseDto>;
  /**
   * Folder path keys (`path.join('/')`) the user has published to before.
   * Owned by the host, which is also what persists them — this hook never
   * touches browser storage (library isolation).
   */
  rememberedFolderKeys?: string[];
  /**
   * Called with the next remembered-key list when {@link
   * UsePublishFoldersResult.rememberPublishFolder} records a destination.
   * Omit it for a host that does not persist destinations.
   */
  onRememberedFolderKeysChange?: (folderKeys: string[]) => void;
}

/** Result returned by {@link usePublishFolders}. */
export interface UsePublishFoldersResult {
  /** Folder tree loaded so far from the Organization/public bucket. */
  folderItems: PublishFolderNode[];
  /** Folder path keys currently expanded in the tree. */
  expandedPaths: Set<string>;
  /** Folder path keys whose children have already been fetched. */
  loadedPaths: Set<string>;
  /** Folder path keys currently being fetched. */
  loadingPaths: Set<string>;
  /** Called by the folder tree when the set of expanded folders changes. */
  onExpandedPathsChange: (paths: Set<string>) => void;
  /**
   * Adds a folder under `parentPath` to the in-memory tree only — it is
   * never created on the backend here. The path becomes real once the user
   * actually publishes to it: the publish request writes to the nested
   * `folderPath`, which DIAL Core storage creates implicitly, the same way
   * writing a file to a new prefix does. This avoids leaving an orphaned
   * empty folder behind when the user picks a new-folder name and then
   * cancels the publish. Because the folder exists only locally, it is kept
   * apart from the listing cache, so a listing that arrives afterwards
   * cannot drop it again.
   */
  onCreatePublishFolder: (parentPath: string[], name: string) => Promise<void>;
  /**
   * Records `folderPath` as a publish destination the user has actually used,
   * so it keeps appearing in the tree on later publishes. Call it after a
   * successful publish.
   */
  rememberPublishFolder: (folderPath: string[]) => void;
  /** Heuristic write-access check for a folder path (see the TODO above). */
  hasPublishWriteAccess: (folderPath: string[]) => boolean;
}

/**
 * Loads the Organization/public bucket's folder tree lazily (one listing per
 * expanded folder, cached by API path) for the Publish flow's folder picker,
 * shared by catalog-entity publish and conversation publish. Scoped to folders
 * only — unlike `useDialFileManager`, it does not list files, rename,
 * copy/move, or upload.
 *
 * Destinations the user has already published to are merged into that tree
 * from `rememberedFolderKeys`. Publishing creates a DIAL Core publication
 * *request*, so a folder picked during publish is not a listable resource in
 * the public files bucket this tree is built from — the remembered list is
 * what keeps such a folder selectable for the next publish instead of
 * vanishing when the panel is reopened.
 *
 * Takes `listPublicFiles` as a parameter and hands remembered destinations
 * back through a callback, so it imports no app context and no storage API.
 */
export const usePublishFolders = ({
  listPublicFiles,
  rememberedFolderKeys,
  onRememberedFolderKeysChange,
}: UsePublishFoldersParams): UsePublishFoldersResult => {
  const [cache, setCache] = useState<Map<string, ListFilesItemDto[]>>(
    () => new Map(),
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(
    () => new Set(),
  );
  /*
   * Folders created during this session, kept as path keys outside `cache`
   * because they exist only locally (see `onCreatePublishFolder`). Holding
   * them in the listing cache instead lost them whenever the parent's real
   * listing landed afterwards — which is exactly what "Add child" on a
   * not-yet-listed folder triggers, since it expands that folder (#8568).
   */
  const [createdFolderKeys, setCreatedFolderKeys] = useState<string[]>([]);

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

  const fetchFolder = useCallback(
    async (apiPath: string) => {
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
    },
    [listPublicFiles],
  );

  useEffect(() => {
    void fetchFolder('');
    /* Root folder is fetched once, on mount. */
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
    (parentPath: string[], name: string): Promise<void> => {
      const folderKey = toFolderPathKey([...parentPath, name]);
      setCreatedFolderKeys((prev) =>
        prev.includes(folderKey) ? prev : [...prev, folderKey],
      );
      return Promise.resolve();
    },
    [],
  );

  const rememberPublishFolder = useCallback(
    (folderPath: string[]) => {
      const folderKey = toFolderPathKey(folderPath);
      /* Guarded: the stored value is user-visible and survives app versions. */
      const storedKeys = Array.isArray(rememberedFolderKeys)
        ? rememberedFolderKeys
        : [];
      if (!folderKey || storedKeys.includes(folderKey)) {
        return;
      }
      onRememberedFolderKeysChange?.(
        [folderKey, ...storedKeys].slice(0, MAX_REMEMBERED_FOLDERS),
      );
    },
    [rememberedFolderKeys, onRememberedFolderKeysChange],
  );

  const hasPublishWriteAccess = useCallback(
    (folderPath: string[]) => !folderPath.includes(RESTRICTED_FOLDER_SEGMENT),
    [],
  );

  const folderItems = useMemo(() => {
    const storedKeys = Array.isArray(rememberedFolderKeys)
      ? rememberedFolderKeys.filter((key) => typeof key === 'string')
      : [];
    return mergeFolderPaths(buildFolderNodes(cache, '', []), [
      ...storedKeys.map(fromFolderPathKey),
      ...createdFolderKeys.map(fromFolderPathKey),
    ]);
  }, [cache, rememberedFolderKeys, createdFolderKeys]);

  return {
    folderItems,
    expandedPaths,
    loadedPaths,
    loadingPaths,
    onExpandedPathsChange,
    onCreatePublishFolder,
    rememberPublishFolder,
    hasPublishWriteAccess,
  };
};
