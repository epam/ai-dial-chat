import type { DialFile } from '@epam/ai-dial-ui-kit';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import type { ListFilesItemDto } from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listFiles } from '../../server-api/files.api';

export interface UseDialFileManagerOptions {
  /** DIAL Core bucket to browse. */
  bucket: string;
  /** Display name for the root folder node. Defaults to `'All files'`. */
  rootLabel?: string;
}

export interface UseDialFileManagerResult {
  /** Hierarchical items for DialFileManager's `items` prop. */
  items: DialFile[];
  /** True while the current folder is loading. */
  isLoading: boolean;
  /** Non-null when the last fetch failed. */
  error: string | null;
  /** Current path in DialFileManager format (e.g. `"/All files"`, `"/All files/reports/"`). */
  path: string;
  /** Pass directly to DialFileManager's `onPathChange`. */
  onPathChange: (nextPath?: string) => void;
  /** Re-runs the fetch for the current `folderPath`. */
  retry: () => void;
}

const safeDecodeURI = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/**
 * Recursively builds a DialFile[] for a folder from the cache.
 * virtualBasePath is the navigation path of the parent folder (no trailing
 * slash), e.g. "/All files" or "/All files/appdata".
 * apiPath is the folder's API listing key, e.g. "" (root) or "appdata/".
 */
const buildFromCache = (
  cache: Map<string, ListFilesItemDto[]>,
  apiPath: string,
  virtualBasePath: string,
  folderId: string,
): DialFile[] => {
  const flat = cache.get(apiPath);
  if (flat == null) return [];

  return flat.map((item): DialFile => {
    const isFolder = item.nodeType === ListFilesItemDtoNodeTypeEnum.Folder;
    const name = safeDecodeURI(item.name);
    const virtualPath = isFolder
      ? `${virtualBasePath}/${name}/`
      : `${virtualBasePath}/${name}`;

    const base: DialFile = {
      id: item.path,
      name,
      path: virtualPath,
      url: item.url,
      parentPath: virtualBasePath,
      nodeType: isFolder ? DialFileNodeType.FOLDER : DialFileNodeType.ITEM,
      folderId,
      bucket: item.bucket,
      author: item.author,
      resourceType: item.resourceType as DialFile['resourceType'],
      contentLength: item.contentLength,
      contentType: item.contentType,
      updatedAt: item.updatedAt
        ? new Date(item.updatedAt).toISOString()
        : undefined,
    };

    if (isFolder) {
      base.items = buildFromCache(
        cache,
        `${apiPath}${name}/`,
        `${virtualBasePath}/${name}`,
        item.path,
      );
    }

    return base;
  });
};

/**
 * Manages DIAL file-storage browsing state for DialFileManager.
 *
 * Uses a per-folder cache so that navigating into a subfolder does not
 * discard already-loaded sibling folders from the tree. Each time a folder
 * is visited, its items are fetched and stored in the cache; the full
 * DialFile hierarchy is recomputed from the accumulated cache on every
 * cache update.
 *
 * wrapInRootFolder from the ui-kit is intentionally avoided: it requires
 * a root item with parentPath="" and uppercase nodeType="FOLDER" in the
 * flat list, which the files API does not produce.
 *
 * The cancelled flag prevents setState after unmount when a fetch is in
 * flight at cleanup time.
 */
export const useDialFileManager = ({
  bucket,
  rootLabel = 'All files',
}: UseDialFileManagerOptions): UseDialFileManagerResult => {
  const [folderPath, setFolderPath] = useState('');
  const [cache, setCache] = useState<Map<string, ListFilesItemDto[]>>(
    () => new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listFiles({ bucket, path: folderPath })
      .then(({ items: flat }) => {
        if (cancelled) return;
        setCache((prev) => new Map(prev).set(folderPath, flat));
      })
      .catch(() => {
        if (cancelled) return;
        setError('dialFileManager.error');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, folderPath, retryCounter]);

  const items = useMemo(
    (): DialFile[] => [
      {
        id: bucket,
        name: rootLabel,
        path: `/${rootLabel}`,
        parentPath: '',
        nodeType: DialFileNodeType.FOLDER,
        folderId: bucket,
        items: buildFromCache(cache, '', `/${rootLabel}`, bucket),
      },
    ],
    [cache, rootLabel, bucket],
  );

  const onPathChange = useCallback(
    (nextPath?: string) => {
      if (nextPath == null) {
        setFolderPath('');
        return;
      }
      // DialFileManager may omit the leading "/" from the virtual path it
      // passes back (e.g. "All files/appdata" instead of "/All files/appdata/").
      // Normalise both forms so we always get a clean API folder path.
      const rootWithSlash = `/${rootLabel}/`; // "/All files/"
      const labelWithSlash = `${rootLabel}/`; // "All files/"

      if (
        nextPath === `/${rootLabel}` ||
        nextPath === rootWithSlash ||
        nextPath === rootLabel ||
        nextPath === labelWithSlash
      ) {
        setFolderPath('');
        return;
      }

      let stripped: string;
      if (nextPath.startsWith(rootWithSlash)) {
        stripped = nextPath.slice(rootWithSlash.length);
      } else if (nextPath.startsWith(labelWithSlash)) {
        stripped = nextPath.slice(labelWithSlash.length);
      } else {
        // Unexpected format: strip leading slash then the root label if still present.
        const withoutLeadingSlash = nextPath.replace(/^\//, '');
        stripped = withoutLeadingSlash.startsWith(labelWithSlash)
          ? withoutLeadingSlash.slice(labelWithSlash.length)
          : withoutLeadingSlash;
      }

      // Ensure a trailing slash for cache key consistency with buildFromCache.
      setFolderPath(
        stripped && !stripped.endsWith('/') ? `${stripped}/` : stripped,
      );
    },
    [rootLabel],
  );

  const retry = useCallback(() => {
    setRetryCounter((c) => c + 1);
  }, []);

  const path = folderPath ? `/${rootLabel}/${folderPath}` : `/${rootLabel}`;

  return { items, isLoading, error, path, onPathChange, retry };
};
