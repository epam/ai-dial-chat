import type { DialFile } from '@epam/ai-dial-ui-kit';
import {
  DialFileManagerTabs,
  DialFileNodeType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type {
  CreateFolderResponseDto,
  ListFilesItemDto,
} from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { listSharedByMe } from '../../server-api/files.api';
import { virtualPathToApiPath } from '../../utils/resolve-dial-file-api-path';
import { safeDecodeURI } from '../../utils/string-utils';
import {
  buildFromCache,
  fetchByTab,
  fetchForSearch,
  mapCorePermissions,
  mapSearchItem,
  mergeCreatedFolderIntoCache,
} from './dial-file-manager-mapping.util';
import {
  buildSharedItemVirtualPath,
  dialCorePathToRelative,
  findFolderByVirtualPath,
  normalizeVirtualPath,
} from './dial-file-manager-path.util';
import type { SharedRootMeta } from './dial-file-manager.model';

export interface UseDialFileListingOptions {
  bucket: string;
  rootLabel: string;
  activeTab: DialFileManagerTabs;
  onNotification?: (notification: {
    variant: NotificationVariant;
    title?: string;
    message: string;
  }) => void;
}

export interface UseDialFileListingResult {
  items: DialFile[];
  isLoading: boolean;
  error: string | null;
  path: string;
  /** Bucket-relative path of the currently browsed folder (e.g. `"reports/"`, `""` for root). */
  folderPath: string;
  onPathChange: (nextPath?: string) => void;
  retry: () => void;
  onSearchFiles: (folder: string, query: string) => void;
  isSearching: boolean;
  searchResults: DialFile[] | null;
  clearSearchResults: () => void;
  expandedPaths: Set<string>;
  loadedPaths: Set<string>;
  onExpandedPathsChange: (paths: Set<string>) => void;
  onFolderPopupPathChange: (nextPath?: string) => void;
  folderPopupLoadingPaths: Set<string>;
  sharedWithMeIds: string[] | undefined;
  sharedByMePaths: Set<string>;
  currentFolder: DialFile | undefined;
  /** Read-only snapshot of the per-folder listing cache, for `useDialFileUploadBatch`'s overwrite-mode check. */
  cache: Map<string, ListFilesItemDto[]>;
  /** Read-only snapshot of per-folder permissions, for `useDialFileMutations`'s create-folder inherited permissions. */
  listingPermissionsCache: Map<string, string[] | undefined>;
  /** Owner-bucket resolution metadata for the Shared tab, populated by the root listing fetch. */
  sharedRootMetaRef: React.RefObject<Map<string, SharedRootMeta>>;
  /** Imperatively navigates the current folder — used by mutations after a rename/delete of the browsed folder. */
  setFolderPath: React.Dispatch<React.SetStateAction<string>>;
  /**
   * Deletes the given API-path cache keys so the next listing fetch/expand for
   * that folder re-fetches from the server. The only way sibling sub-hooks may
   * invalidate the shared cache (design.md D1).
   */
  invalidateFolders: (apiPaths: string[]) => void;
  /** Merges a just-created folder into its parent's cache entry (optimistic display for create-folder). */
  mergeCreatedFolder: (
    parentApiPath: string,
    created: CreateFolderResponseDto,
    inheritedPermissions?: string[],
  ) => void;
  /** Forces the listing effect to re-fetch the currently browsed folder. */
  bumpRetry: () => void;
}

/**
 * Manages DIAL file-storage browsing state: folder listing/navigation, the
 * tree's expand/collapse state, search, and the shared per-folder cache that
 * `useDialFileUploadBatch`/`useDialFileMutations`/`useDialFileSharing` invalidate
 * through `invalidateFolders`/`bumpRetry` after their own mutations settle
 * (design.md D1) — this hook is the sole owner/writer of that cache.
 *
 * Supports three listing sources via `activeTab`:
 * - my_files: user's own bucket via GET /api/v1/files/list
 * - shared: files shared with the user via GET /api/v1/files/shared
 * - organization: public bucket via GET /api/v1/files/public
 */
export const useDialFileListing = ({
  bucket,
  rootLabel,
  activeTab,
  onNotification,
}: UseDialFileListingOptions): UseDialFileListingResult => {
  const { t } = useTranslation();

  const [folderPath, setFolderPath] = useState('');
  const [cache, setCache] = useState<Map<string, ListFilesItemDto[]>>(
    () => new Map(),
  );
  const cacheRef = useRef(cache);
  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);
  const [listingPermissionsCache, setListingPermissionsCache] = useState<
    Map<string, string[] | undefined>
  >(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);
  const [sharedRootIds, setSharedRootIds] = useState<string[] | undefined>(
    undefined,
  );
  const [sharedByMePaths, setSharedByMePaths] = useState<Set<string>>(
    () => new Set(),
  );

  // Maps shared root folder name → { bucket, dialCorePath } for subfolder navigation.
  const sharedRootMetaRef = useRef<Map<string, SharedRootMeta>>(new Map());

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DialFile[] | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCancelRef = useRef<(() => void) | null>(null);
  const expandingApiPathsRef = useRef<Set<string>>(new Set());
  /*
   * Folder api paths whose last expand fetch failed — excluded from auto-retry
   * on unrelated expand/collapse until the user collapses and re-expands them.
   */
  const erroredApiPathsRef = useRef<Set<string>>(new Set());

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [folderPopupLoadingPaths, setFolderPopupLoadingPaths] = useState<
    Set<string>
  >(() => new Set());

  // Clear cache and reset path on tab switch
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    setCache(new Map());
    setListingPermissionsCache(new Map());
    setFolderPath('');
    setSharedRootIds(undefined);
    sharedRootMetaRef.current = new Map();
    expandingApiPathsRef.current = new Set();
    erroredApiPathsRef.current = new Set();
    setFolderPopupLoadingPaths(new Set());
    if (searchDebounceRef.current != null) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    searchCancelRef.current?.();
    searchCancelRef.current = null;
    setSearchResults(null);
    setIsSearching(false);
    setExpandedPaths(new Set());
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current != null) {
        clearTimeout(searchDebounceRef.current);
      }
      searchCancelRef.current?.();
    };
  }, []);

  // Fires on mount for every variant (including Standalone) because
  // `folderPath` initializes to `''` above — no separate mount-effect is
  // needed to satisfy the standalone page's "load root listing on open"
  // requirement; it falls out of this effect's existing dependency array.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchByTab(activeTab, bucket, folderPath, sharedRootMetaRef.current)
      .then(({ items: flat, permissions }) => {
        if (cancelled) return;
        setCache((prev) => {
          const next = new Map(prev);
          next.set(folderPath, flat);
          return next;
        });
        setListingPermissionsCache((prev) =>
          new Map(prev).set(folderPath, permissions),
        );
        // Capture root-level shared item paths for sharedWithMeIds and subfolder navigation
        if (activeTab === DialFileManagerTabs.Shared && folderPath === '') {
          setSharedRootIds(
            flat.map((item) => {
              const relative = dialCorePathToRelative(
                item.path,
                item.bucket ?? '',
              );
              return buildSharedItemVirtualPath(
                relative,
                rootLabel,
                item.nodeType === ListFilesItemDtoNodeTypeEnum.Folder,
              );
            }),
          );
          sharedRootMetaRef.current = new Map(
            flat.map((item) => [
              safeDecodeURI(item.name),
              { bucket: item.bucket ?? '', dialCorePath: item.path },
            ]),
          );
        }
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
  }, [activeTab, bucket, folderPath, retryCounter, rootLabel]);

  // sharedByMePaths is bucket-scoped (not folder-scoped) — fetched once per
  // my_files tab activation/retry, independent of the folder-listing effect above.
  useEffect(() => {
    if (activeTab !== DialFileManagerTabs.MyFiles) {
      setSharedByMePaths(new Set());
      return;
    }

    let cancelled = false;
    listSharedByMe(bucket)
      .then((res) => {
        if (cancelled) return;
        setSharedByMePaths(
          new Set(
            res.items.map((item) => {
              const relative = dialCorePathToRelative(item.path, bucket);
              return buildSharedItemVirtualPath(
                relative,
                rootLabel,
                item.nodeType === ListFilesItemDtoNodeTypeEnum.Folder,
              );
            }),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setSharedByMePaths(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, bucket, retryCounter, rootLabel]);

  const items = useMemo(
    (): DialFile[] => [
      {
        id: bucket,
        name: rootLabel,
        path: `/${rootLabel}`,
        parentPath: '',
        nodeType: DialFileNodeType.FOLDER,
        folderId: bucket,
        permissions: mapCorePermissions(listingPermissionsCache.get('')),
        items: buildFromCache(
          cache,
          listingPermissionsCache,
          '',
          `/${rootLabel}`,
          bucket,
        ),
      },
    ],
    [cache, listingPermissionsCache, rootLabel, bucket],
  );

  const onPathChange = useCallback(
    (nextPath?: string) => {
      if (nextPath == null) {
        setFolderPath('');
        return;
      }
      const rootWithSlash = `/${rootLabel}/`;
      const labelWithSlash = `${rootLabel}/`;

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
        const withoutLeadingSlash = nextPath.replace(/^\//, '');
        stripped = withoutLeadingSlash.startsWith(labelWithSlash)
          ? withoutLeadingSlash.slice(labelWithSlash.length)
          : withoutLeadingSlash;
      }

      setFolderPath(
        stripped && !stripped.endsWith('/') ? `${stripped}/` : stripped,
      );
    },
    [rootLabel],
  );

  const retry = useCallback(() => {
    setRetryCounter((c) => c + 1);
  }, []);

  const bumpRetry = retry;

  const invalidateFolders = useCallback(
    (apiPaths: string[]) => {
      if (apiPaths.length === 0) return;

      /*
       * `folderPath` itself is refetched by the retryCounter-driven effect
       * above (via bumpRetry), which already replaces the cache entry only
       * once fresh data arrives rather than deleting it upfront. Any other
       * invalidated key that is an ancestor of `folderPath` — or an
       * already-expanded tree node — is otherwise never refetched:
       * `buildFromCache` recurses top-down from the bucket root, so a
       * deleted ancestor entry breaks the tree walk and makes the
       * still-cached `folderPath` node disappear from `items` until the
       * ancestor is explicitly refetched here.
       */
      const expandedApiPaths = new Set(
        [...expandedPaths].map((p) => virtualPathToApiPath(p, rootLabel)),
      );
      const isVisible = (k: string): boolean =>
        k === folderPath || folderPath.startsWith(k) || expandedApiPaths.has(k);

      /*
       * Keys that aren't currently rendered are safe to purge outright — the
       * next browse/expand will lazily refetch them. Keys that ARE visible
       * are refreshed in place instead (fetch first, then overwrite the
       * cache entry): deleting a visible key before the refetch resolves
       * makes `buildFromCache` treat it as empty for that window, producing
       * a visible flash of "No files yet" even though the old data was
       * still correct.
       */
      const keysToPurgeImmediately = apiPaths.filter((k) => !isVisible(k));
      const keysNeedingRefetch = apiPaths.filter(
        (k) => isVisible(k) && k !== folderPath,
      );

      if (keysToPurgeImmediately.length > 0) {
        setCache((prev) => {
          const next = new Map(prev);
          keysToPurgeImmediately.forEach((k) => next.delete(k));
          return next;
        });
        setListingPermissionsCache((prev) => {
          const next = new Map(prev);
          keysToPurgeImmediately.forEach((k) => next.delete(k));
          return next;
        });
      }

      keysNeedingRefetch.forEach((apiPath) => {
        const loadFolder = async (): Promise<void> => {
          try {
            const { items: flat, permissions } = await fetchByTab(
              activeTab,
              bucket,
              apiPath,
              sharedRootMetaRef.current,
            );
            setCache((prev) => new Map(prev).set(apiPath, flat));
            if (permissions != null) {
              setListingPermissionsCache((prev) =>
                new Map(prev).set(apiPath, permissions),
              );
            }
          } catch {
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(DialFileManagerI18nKeys.FolderLoadError),
            });
          }
        };
        void loadFolder();
      });
    },
    [
      activeTab,
      bucket,
      folderPath,
      expandedPaths,
      rootLabel,
      onNotification,
      t,
    ],
  );

  const mergeCreatedFolder = useCallback(
    (
      parentApiPath: string,
      created: CreateFolderResponseDto,
      inheritedPermissions?: string[],
    ) => {
      setCache((prev) =>
        mergeCreatedFolderIntoCache(
          prev,
          parentApiPath,
          created,
          inheritedPermissions,
        ),
      );
    },
    [],
  );

  const onFolderPopupPathChange = useCallback(
    (nextPath?: string) => {
      const apiPath =
        nextPath == null ? '' : virtualPathToApiPath(nextPath, rootLabel);
      const virtualPath =
        nextPath == null ? `/${rootLabel}` : normalizeVirtualPath(nextPath);

      if (cacheRef.current.has(apiPath)) {
        return;
      }

      if (expandingApiPathsRef.current.has(apiPath)) {
        setFolderPopupLoadingPaths((prev) => {
          const next = new Set(prev);
          next.add(virtualPath);
          return next;
        });
        return;
      }

      expandingApiPathsRef.current.add(apiPath);
      setFolderPopupLoadingPaths((prev) => {
        const next = new Set(prev);
        next.add(virtualPath);
        return next;
      });

      const loadFolder = async (): Promise<void> => {
        try {
          const { items: flat, permissions } = await fetchByTab(
            activeTab,
            bucket,
            apiPath,
            sharedRootMetaRef.current,
          );
          setCache((prev) => new Map(prev).set(apiPath, flat));
          if (permissions != null) {
            setListingPermissionsCache((prev) =>
              new Map(prev).set(apiPath, permissions),
            );
          }
          erroredApiPathsRef.current.delete(apiPath);
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            message: t(DialFileManagerI18nKeys.FolderLoadError),
          });
        } finally {
          expandingApiPathsRef.current.delete(apiPath);
          setFolderPopupLoadingPaths((prev) => {
            const next = new Set(prev);
            next.delete(virtualPath);
            return next;
          });
        }
      };

      void loadFolder();
    },
    [activeTab, bucket, onNotification, rootLabel, t],
  );

  const loadedPaths = useMemo(() => {
    const result = new Set<string>();
    for (const virtualPath of expandedPaths) {
      const apiPath = virtualPathToApiPath(virtualPath, rootLabel);
      if (cache.has(apiPath)) {
        result.add(virtualPath);
      }
    }
    return result;
  }, [expandedPaths, cache, rootLabel]);

  const onExpandedPathsChange = useCallback(
    (paths: Set<string>) => {
      /*
       * Collapsed folders drop out of `paths` — clear their errored state so
       * re-expanding the same folder later retries instead of staying blocked.
       */
      expandedPaths.forEach((p) => {
        if (!paths.has(p)) {
          erroredApiPathsRef.current.delete(virtualPathToApiPath(p, rootLabel));
        }
      });

      setExpandedPaths(paths);
      const newlyExpanded = [...paths].filter((p) => {
        const apiPath = virtualPathToApiPath(p, rootLabel);
        return (
          !cacheRef.current.has(apiPath) &&
          !expandingApiPathsRef.current.has(apiPath) &&
          !erroredApiPathsRef.current.has(apiPath)
        );
      });
      newlyExpanded.forEach((virtualPath) => {
        const apiPath = virtualPathToApiPath(virtualPath, rootLabel);
        expandingApiPathsRef.current.add(apiPath);
        const loadFolder = async (): Promise<void> => {
          try {
            const { items: flat, permissions } = await fetchByTab(
              activeTab,
              bucket,
              apiPath,
              sharedRootMetaRef.current,
            );
            setCache((prev) => new Map(prev).set(apiPath, flat));
            if (permissions != null) {
              setListingPermissionsCache((prev) =>
                new Map(prev).set(apiPath, permissions),
              );
            }
          } catch {
            erroredApiPathsRef.current.add(apiPath);
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(DialFileManagerI18nKeys.FolderLoadError),
            });
          } finally {
            expandingApiPathsRef.current.delete(apiPath);
            setFolderPopupLoadingPaths((prev) => {
              const next = new Set(prev);
              next.delete(normalizeVirtualPath(virtualPath));
              return next;
            });
          }
        };
        void loadFolder();
      });
    },
    [activeTab, bucket, expandedPaths, onNotification, rootLabel, t],
  );

  const clearSearchResults = useCallback(() => {
    if (searchDebounceRef.current != null) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    searchCancelRef.current?.();
    searchCancelRef.current = null;
    setSearchResults(null);
    setIsSearching(false);
  }, []);

  const onSearchFiles = useCallback(
    (_folder: string, query: string) => {
      if (searchDebounceRef.current != null) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      /*
       * Cancel any in-flight search immediately on every keystroke, so a
       * slower stale fetch can never overwrite the results of a newer one.
       */
      searchCancelRef.current?.();
      searchCancelRef.current = null;

      if (!query.trim()) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }
      searchDebounceRef.current = setTimeout(() => {
        searchDebounceRef.current = null;
        const lowerQuery = query.toLowerCase();

        // Shared root: filter already-loaded root items from the cache (no BFF call).
        if (activeTab === DialFileManagerTabs.Shared && folderPath === '') {
          searchCancelRef.current?.();
          searchCancelRef.current = null;
          setIsSearching(true);
          const rootItems = cache.get('') ?? [];
          const matched = rootItems.filter((item) =>
            safeDecodeURI(item.name).toLowerCase().includes(lowerQuery),
          );
          setSearchResults(
            matched.map((item) =>
              mapSearchItem(item, item.bucket ?? bucket, rootLabel),
            ),
          );
          setIsSearching(false);
          return;
        }

        let cancelled = false;
        searchCancelRef.current = () => {
          cancelled = true;
        };
        setIsSearching(true);
        const runSearch = async (): Promise<void> => {
          try {
            const { items: searchItems } = await fetchForSearch(
              activeTab,
              bucket,
              folderPath,
              sharedRootMetaRef.current,
            );
            if (cancelled) return;
            const matched = searchItems.filter((item) =>
              safeDecodeURI(item.name).toLowerCase().includes(lowerQuery),
            );
            setSearchResults(
              matched.map((item) =>
                mapSearchItem(item, item.bucket ?? bucket, rootLabel),
              ),
            );
          } catch {
            if (!cancelled) setSearchResults([]);
          } finally {
            if (!cancelled) setIsSearching(false);
          }
        };
        void runSearch();
      }, 300);
    },
    [activeTab, bucket, cache, folderPath, rootLabel],
  );

  const path = folderPath ? `/${rootLabel}/${folderPath}` : `/${rootLabel}`;

  const currentFolder = useMemo((): DialFile | undefined => {
    const root = items[0];
    if (!root) return undefined;
    if (normalizeVirtualPath(path) === normalizeVirtualPath(`/${rootLabel}`)) {
      return root;
    }
    return findFolderByVirtualPath(root.items ?? [], path);
  }, [items, path, rootLabel]);

  const sharedWithMeIds = useMemo(
    (): string[] | undefined =>
      activeTab === DialFileManagerTabs.Shared ? sharedRootIds : undefined,
    [activeTab, sharedRootIds],
  );

  return {
    items,
    isLoading,
    error,
    path,
    folderPath,
    onPathChange,
    retry,
    onSearchFiles,
    isSearching,
    searchResults,
    clearSearchResults,
    expandedPaths,
    loadedPaths,
    onExpandedPathsChange,
    onFolderPopupPathChange,
    folderPopupLoadingPaths,
    sharedWithMeIds,
    sharedByMePaths,
    currentFolder,
    cache,
    listingPermissionsCache,
    sharedRootMetaRef,
    setFolderPath,
    invalidateFolders,
    mergeCreatedFolder,
    bumpRetry,
  };
};
