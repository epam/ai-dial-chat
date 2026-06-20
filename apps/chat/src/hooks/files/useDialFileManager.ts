import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import type {
  DialDeletedItem,
  DialFile,
  DialUploadFileItem,
} from '@epam/ai-dial-ui-kit';
import { DialFileNodeType, DialFilePermission } from '@epam/ai-dial-ui-kit';
import type {
  CreateFolderResponseDto,
  DeleteItemDto,
  ListFilesItemDto,
} from '@epam/chat-api-client';
import {
  ArchiveItemDtoNodeTypeEnum,
  DeleteItemDtoNodeTypeEnum,
  ListFilesItemDtoNodeTypeEnum,
} from '@epam/chat-api-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  FileUploadBatchState,
  FileUploadEntry,
} from '../../components/DialFileManagerModal/types/upload';
import { FileUploadStatus } from '../../components/DialFileManagerModal/types/upload';
import {
  createFolder,
  deleteFiles,
  downloadArchive,
  downloadFile,
  listFiles,
  uploadFile,
} from '../../server-api/files.api';
import {
  DownloadDestinationType,
  prepareDownloadDestination,
  triggerBrowserDownload,
} from '../../utils/file-download';
import { resolveRelativeDialFilePath } from '../../utils/icon-path';
import { safeDecodeURI } from '../../utils/string-utils';
import {
  logDialFileManagerDebug,
  summarizeDialFileManagerCache,
} from './dial-file-manager-debug';

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

  /** Upload: start a new batch. */
  onUploadFiles: (
    files: DialUploadFileItem[],
    destinationFolder: string,
  ) => void;
  /** Upload: validate file names before upload (called by DialFileManager). */
  onValidateUpload: (
    files: DialUploadFileItem[],
    existingFiles: DialFile[],
    destinationFolder: string,
  ) => Promise<FileUploadValidationResult>;
  /** Upload: current batch state (null when idle). */
  uploadBatchState: FileUploadBatchState | null;
  /** Upload: abort all in-flight and queued uploads. */
  cancelUpload: () => void;
  /** Upload: dismiss the progress modal after the batch has settled. */
  clearUploadBatch: () => void;

  /** Folder creation: called when user confirms a new folder name. */
  onCreateFolder: (
    file: DialUploadFileItem,
    folderPath: string,
    fileId: string,
  ) => Promise<void>;
  /** Folder creation: inline synchronous validation (returns error message or null). */
  onCreateFolderValidate: (
    name: string,
    parentFolder: DialFile,
  ) => string | null;
  /** True while a folder creation request is in flight. */
  isCreatingFolder: boolean;

  /** Download: called when user triggers download on one or more items. */
  onDownloadFiles: (dialFiles: DialFile[]) => void;
  /** True while a download is in progress. */
  isDownloading: boolean;
  /** Non-null when the last download failed. Cleared by `clearDownloadError`. */
  downloadError: string | null;
  /** Clears `downloadError`. */
  clearDownloadError: () => void;

  /** Delete: called when user confirms deletion of one or more items. */
  onDeleteFiles: (items: DialDeletedItem[], sourceFolder: string) => void;
  /** True while a delete request is in flight. */
  isDeleting: boolean;
  /** Non-null when the last delete had at least one failure. Cleared by `clearDeleteError`. */
  deleteError: string | null;
  /** Clears `deleteError`. */
  clearDeleteError: () => void;

  /** True when the current folder grants WRITE (upload + new folder). */
  uploadEnabled: boolean;
  /** True when Upload/New must be disabled (no WRITE on current folder). */
  isNewButtonDisabled: boolean;
  /** Tooltip for disabled New/Upload when `isNewButtonDisabled` is true. */
  disabledNewButtonTooltip: string;
}

interface FileUploadValidationResult {
  valid: boolean;
  message?: string;
}

const UPLOAD_CONCURRENCY = 3;
const RESERVED_MARKER_NAME = HIDDEN_FILE;

const CORE_PERMISSION_MAP: Record<string, DialFilePermission> = {
  READ: DialFilePermission.READ,
  WRITE: DialFilePermission.WRITE,
  SHARE: DialFilePermission.SHARE,
};

const mapCorePermissions = (
  permissions?: string[],
): DialFile['permissions'] | undefined => {
  if (!permissions?.length) return undefined;
  const mapped = permissions
    .map((permission) => CORE_PERMISSION_MAP[permission.toUpperCase()])
    .filter(
      (permission): permission is DialFilePermission => permission != null,
    );
  return mapped.length > 0 ? mapped : undefined;
};

const normalizeVirtualPath = (value: string): string => {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed || '/';
};

const findFolderByVirtualPath = (
  nodes: DialFile[],
  virtualPath: string,
): DialFile | undefined => {
  const target = normalizeVirtualPath(virtualPath);
  for (const node of nodes) {
    if (node.nodeType !== DialFileNodeType.FOLDER) continue;
    if (normalizeVirtualPath(node.path) === target) return node;
    const nested = findFolderByVirtualPath(node.items ?? [], virtualPath);
    if (nested) return nested;
  }
  return undefined;
};

const hasDialFileWritePermission = (folder?: DialFile): boolean =>
  folder?.permissions?.includes(DialFilePermission.WRITE) ?? false;

/**
 * DialFileManager passes the new folder's full virtual path (including the name),
 * e.g. "/All files/reports" or "/All files/reports/Q1".
 */
const parseNewFolderVirtualPath = (
  newFolderVirtualPath: string,
  rootLabel: string,
): { parentVirtualPath: string; name: string } => {
  const trimmed = newFolderVirtualPath.replace(/\/$/, '');
  const slashIndex = trimmed.lastIndexOf('/');

  if (slashIndex <= 0) {
    const name = slashIndex === 0 ? trimmed.slice(1) : trimmed;
    return { parentVirtualPath: `/${rootLabel}`, name };
  }

  return {
    parentVirtualPath: trimmed.slice(0, slashIndex),
    name: trimmed.slice(slashIndex + 1),
  };
};

/**
 * Converts a DialFileManager virtual path to an API folder path.
 * e.g. "/All files" → "", "/All files/reports/" → "reports/"
 */
const virtualPathToApiPath = (
  virtualPath: string,
  rootLabel: string,
): string => {
  const rootExact = `/${rootLabel}`;
  const rootWithSlash = `/${rootLabel}/`;
  const labelWithSlash = `${rootLabel}/`;

  if (
    virtualPath === rootExact ||
    virtualPath === `${rootLabel}` ||
    virtualPath === rootWithSlash ||
    virtualPath === labelWithSlash
  ) {
    return '';
  }

  let stripped: string;
  if (virtualPath.startsWith(rootWithSlash)) {
    stripped = virtualPath.slice(rootWithSlash.length);
  } else if (virtualPath.startsWith(labelWithSlash)) {
    stripped = virtualPath.slice(labelWithSlash.length);
  } else {
    const withoutLeadingSlash = virtualPath.replace(/^\//, '');
    stripped = withoutLeadingSlash.startsWith(labelWithSlash)
      ? withoutLeadingSlash.slice(labelWithSlash.length)
      : withoutLeadingSlash;
  }

  return stripped && !stripped.endsWith('/') ? `${stripped}/` : stripped;
};

/**
 * Recursively builds a DialFile[] for a folder from the cache.
 * virtualBasePath is the navigation path of the parent folder (no trailing
 * slash), e.g. "/All files" or "/All files/appdata".
 * apiPath is the folder's API listing key, e.g. "" (root) or "appdata/".
 */
const buildFromCache = (
  cache: Map<string, ListFilesItemDto[]>,
  listingPermissionsCache: Map<string, string[] | undefined>,
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
      const folderApiPath = `${apiPath}${name}/`;
      base.permissions =
        mapCorePermissions(item.permissions) ??
        mapCorePermissions(listingPermissionsCache.get(folderApiPath));
      base.items = buildFromCache(
        cache,
        listingPermissionsCache,
        folderApiPath,
        `${virtualBasePath}/${name}`,
        item.path,
      );
    }

    return base;
  });
};

const mergeCreatedFolderIntoCache = (
  cache: Map<string, ListFilesItemDto[]>,
  parentApiPath: string,
  created: CreateFolderResponseDto,
  inheritedPermissions?: string[],
): Map<string, ListFilesItemDto[]> => {
  const next = new Map(cache);
  const parentItems = [...(next.get(parentApiPath) ?? [])];
  const folderItem: ListFilesItemDto = {
    name: created.name,
    path: created.path,
    folderId: created.folderId,
    nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
    bucket: created.bucket,
    parentPath: created.parentPath || undefined,
    url: created.path,
    permissions: inheritedPermissions,
  };

  if (
    !parentItems.some(
      (item) => item.name.toLowerCase() === created.name.toLowerCase(),
    )
  ) {
    parentItems.push(folderItem);
  }

  next.set(parentApiPath, parentItems);
  logDialFileManagerDebug('cache merge created folder', {
    parentApiPath: parentApiPath || '(root)',
    folderName: created.name,
    folderPath: created.path,
    folderId: created.folderId,
    parentItems: parentItems.map((item) => item.name),
    cache: summarizeDialFileManagerCache(next),
  });
  return next;
};

const updateEntry = (
  prev: FileUploadBatchState | null,
  index: number,
  patch:
    | FileUploadStatus
    | Partial<Pick<FileUploadEntry, 'status' | 'percent'>>,
): FileUploadBatchState | null => {
  if (!prev) return prev;
  const changes = typeof patch === 'string' ? { status: patch } : patch;
  const files = prev.files.map((f, i) =>
    i === index ? { ...f, ...changes } : f,
  );
  return { ...prev, files };
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
  const { t } = useTranslation();
  const [folderPath, setFolderPath] = useState('');
  const [cache, setCache] = useState<Map<string, ListFilesItemDto[]>>(
    () => new Map(),
  );
  const [listingPermissionsCache, setListingPermissionsCache] = useState<
    Map<string, string[] | undefined>
  >(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  const [uploadBatchState, setUploadBatchState] =
    useState<FileUploadBatchState | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listFiles({ bucket, path: folderPath, permissions: true })
      .then(({ items: flat, permissions }) => {
        if (cancelled) return;
        logDialFileManagerDebug('listFiles response', {
          folderPath: folderPath || '(root)',
          incoming: flat.map((item) => item.name),
          permissions,
          retryCounter,
        });
        setCache((prev) => {
          const next = new Map(prev);
          next.set(folderPath, flat);
          logDialFileManagerDebug('cache after listFiles', {
            cache: summarizeDialFileManagerCache(next),
          });
          return next;
        });
        setListingPermissionsCache((prev) =>
          new Map(prev).set(folderPath, permissions),
        );
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

  const onUploadFiles = useCallback(
    (files: DialUploadFileItem[], destinationFolder: string) => {
      const controller = new AbortController();
      uploadAbortControllerRef.current = controller;

      const entries: FileUploadEntry[] = files.map((f, i) => ({
        id: `${Date.now()}-${i}`,
        name: f.name,
        status: FileUploadStatus.Queued,
      }));

      setUploadBatchState({ files: entries, isOpen: true });

      const destinationApiPath = virtualPathToApiPath(
        destinationFolder,
        rootLabel,
      );

      const processBatch = async () => {
        let nextIndex = 0;

        const worker = async () => {
          while (nextIndex < files.length) {
            const i = nextIndex++;
            const file = files[i];

            if (controller.signal.aborted) {
              setUploadBatchState((prev) =>
                updateEntry(prev, i, FileUploadStatus.Cancelled),
              );
              continue;
            }

            setUploadBatchState((prev) =>
              updateEntry(prev, i, {
                status: FileUploadStatus.Uploading,
                percent: 0,
              }),
            );

            try {
              await uploadFile(
                bucket,
                `${destinationApiPath}${file.name}`,
                file.fileContent,
                {
                  signal: controller.signal,
                  onProgress: (percent) => {
                    setUploadBatchState((prev) =>
                      updateEntry(prev, i, {
                        status: FileUploadStatus.Uploading,
                        percent,
                      }),
                    );
                  },
                },
              );
              setUploadBatchState((prev) =>
                updateEntry(prev, i, {
                  status: FileUploadStatus.Completed,
                  percent: 100,
                }),
              );
            } catch {
              const status = controller.signal.aborted
                ? FileUploadStatus.Cancelled
                : FileUploadStatus.Failed;
              setUploadBatchState((prev) => updateEntry(prev, i, status));
            }
          }
        };

        await Promise.all(
          Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()),
        );

        setCache((prev) => {
          const next = new Map(prev);
          next.delete(destinationApiPath);
          return next;
        });
        setRetryCounter((c) => c + 1);
        uploadAbortControllerRef.current = null;
      };

      void processBatch();
    },
    [bucket, rootLabel],
  );

  const onValidateUpload = useCallback(
    async (
      files: DialUploadFileItem[],
      existingFiles: DialFile[],
      _destinationFolder: string,
    ): Promise<FileUploadValidationResult> => {
      const existingNames = new Set(
        existingFiles.map((f) => f.name.toLowerCase()),
      );
      const conflict = files.some((f) =>
        existingNames.has(f.name.toLowerCase()),
      );
      if (conflict) {
        return {
          valid: false,
          message: t('dialFileManager.uploadConflict'),
        };
      }
      return { valid: true };
    },
    [t],
  );

  const cancelUpload = useCallback(() => {
    uploadAbortControllerRef.current?.abort();
  }, []);

  const onCreateFolder = useCallback(
    async (
      _file: DialUploadFileItem,
      folderPath: string,
      _fileId: string,
    ): Promise<void> => {
      setIsCreatingFolder(true);
      const { parentVirtualPath, name } = parseNewFolderVirtualPath(
        folderPath,
        rootLabel,
      );
      const parentApiPath = virtualPathToApiPath(parentVirtualPath, rootLabel);
      logDialFileManagerDebug('createFolder start', {
        folderPath,
        parentVirtualPath,
        parentApiPath: parentApiPath || '(root)',
        name,
        currentFolderPath: folderPath || '(root)',
      });
      try {
        const created = await createFolder({
          bucket,
          parentPath: parentApiPath || undefined,
          name,
        });
        setCache((prev) =>
          mergeCreatedFolderIntoCache(
            prev,
            parentApiPath,
            created,
            listingPermissionsCache.get(parentApiPath),
          ),
        );
      } finally {
        setIsCreatingFolder(false);
      }
    },
    [bucket, rootLabel, listingPermissionsCache],
  );

  const onCreateFolderValidate = useCallback(
    (name: string, parentFolder: DialFile): string | null => {
      if (!name || name.trim() === '') {
        return t('dialFileManager.folderNameEmpty');
      }
      if (/[/\\]/.test(name)) {
        return t('dialFileManager.folderNameInvalidChars');
      }
      if (name.startsWith('.')) {
        return t('dialFileManager.folderNameHidden');
      }
      if (name === RESERVED_MARKER_NAME) {
        return t('dialFileManager.folderNameReserved');
      }
      if (name.length > 255) {
        return t('dialFileManager.folderNameTooLong');
      }
      const siblings = parentFolder.items ?? [];
      const lowerName = name.toLowerCase();
      if (siblings.some((s) => s.name.toLowerCase() === lowerName)) {
        return t('dialFileManager.folderConflict');
      }
      return null;
    },
    [t],
  );

  const onDownloadFiles = useCallback(
    (dialFiles: DialFile[]) => {
      const run = async () => {
        setIsDownloading(true);
        setDownloadError(null);
        try {
          const filename =
            dialFiles.length === 1
              ? dialFiles[0].nodeType === DialFileNodeType.ITEM
                ? dialFiles[0].name
                : `${dialFiles[0].name}.zip`
              : 'files.zip';
          const destination = await prepareDownloadDestination(
            filename,
            dialFiles.length === 1 &&
              dialFiles[0].nodeType === DialFileNodeType.ITEM
              ? (dialFiles[0].contentType ?? 'application/octet-stream')
              : 'application/zip',
          );
          if (destination.type === DownloadDestinationType.Cancelled) return;

          if (
            dialFiles.length === 1 &&
            dialFiles[0].nodeType === DialFileNodeType.ITEM
          ) {
            const file = dialFiles[0];
            if (!file.bucket || !file.id) {
              throw new Error('File is missing bucket or id');
            }
            const filePath = resolveRelativeDialFilePath(file.id, file.bucket);
            const response = await downloadFile(file.bucket, filePath);
            await triggerBrowserDownload(response, file.name, destination);
          } else {
            const archiveItems = dialFiles.map((f) => ({
              bucket: f.bucket ?? '',
              path: resolveRelativeDialFilePath(f.id ?? f.path, f.bucket ?? ''),
              name: f.name,
              nodeType:
                f.nodeType === DialFileNodeType.FOLDER
                  ? ArchiveItemDtoNodeTypeEnum.Folder
                  : ArchiveItemDtoNodeTypeEnum.Item,
            }));
            const response = await downloadArchive(archiveItems);
            await triggerBrowserDownload(response, filename, destination);
          }
        } catch {
          setDownloadError(t('dialFileManager.downloadError'));
        } finally {
          setIsDownloading(false);
        }
      };
      void run();
    },
    [t],
  );

  const clearDownloadError = useCallback(() => {
    setDownloadError(null);
  }, []);

  const onDeleteFiles = useCallback(
    (deletedItems: DialDeletedItem[], _sourceFolder: string) => {
      const run = async () => {
        setIsDeleting(true);
        setDeleteError(null);

        const dtos: DeleteItemDto[] = deletedItems.map((item) => {
          const isFolder = item.nodeType === DialFileNodeType.FOLDER;
          // virtualPathToApiPath always appends "/", which is correct for folders
          // but wrong for files — strip it for item nodes
          const relPath = isFolder
            ? virtualPathToApiPath(item.sourceUrl, rootLabel)
            : virtualPathToApiPath(item.sourceUrl, rootLabel).replace(
                /\/$/,
                '',
              );
          const segments = item.sourceUrl.split('/').filter(Boolean);
          const name = segments[segments.length - 1] ?? relPath;
          return {
            bucket,
            path: relPath,
            name,
            nodeType: isFolder
              ? DeleteItemDtoNodeTypeEnum.Folder
              : DeleteItemDtoNodeTypeEnum.Item,
          };
        });

        try {
          const { results } = await deleteFiles(dtos);
          const failedCount = results.filter((r) => !r.success).length;

          if (failedCount === results.length) {
            setDeleteError(t('dialFileManager.deleteError'));
          } else if (failedCount > 0) {
            setDeleteError(
              t('dialFileManager.deletePartialError', { count: failedCount }),
            );
          }
        } catch {
          setDeleteError(t('dialFileManager.deleteError'));
        }

        const deletedFolderPaths = dtos
          .filter((d) => d.nodeType === DeleteItemDtoNodeTypeEnum.Folder)
          .map((d) => (d.path.endsWith('/') ? d.path : `${d.path}/`));

        const affectedFolderKeys = new Set<string>(
          dtos.map((d) => {
            if (d.nodeType === DeleteItemDtoNodeTypeEnum.Folder) {
              return d.path.endsWith('/') ? d.path : `${d.path}/`;
            }
            const lastSlash = d.path.lastIndexOf('/');
            return lastSlash > 0 ? d.path.slice(0, lastSlash + 1) : '';
          }),
        );

        setCache((prev) => {
          const next = new Map(prev);
          affectedFolderKeys.forEach((k) => next.delete(k));
          return next;
        });
        setListingPermissionsCache((prev) => {
          const next = new Map(prev);
          affectedFolderKeys.forEach((k) => next.delete(k));
          return next;
        });

        const isCurrentFolderDeleted = deletedFolderPaths.some(
          (fp) => folderPath === fp || folderPath.startsWith(fp),
        );
        if (isCurrentFolderDeleted) {
          setFolderPath((prev) => prev.replace(/[^/]+\/$/, ''));
        }

        setRetryCounter((c) => c + 1);
        setIsDeleting(false);
      };
      void run();
    },
    [bucket, rootLabel, t, folderPath],
  );

  const clearDeleteError = useCallback(() => {
    setDeleteError(null);
  }, []);

  const clearUploadBatch = useCallback(() => {
    setUploadBatchState(null);
  }, []);

  const path = folderPath ? `/${rootLabel}/${folderPath}` : `/${rootLabel}`;

  const currentFolder = useMemo((): DialFile | undefined => {
    const root = items[0];
    if (!root) return undefined;
    if (normalizeVirtualPath(path) === normalizeVirtualPath(`/${rootLabel}`)) {
      return root;
    }
    return findFolderByVirtualPath(root.items ?? [], path);
  }, [items, path, rootLabel]);

  const canWriteCurrentFolder = hasDialFileWritePermission(currentFolder);
  const disabledNewButtonTooltip = t('dialFileManager.noPermissionToCreate');

  return {
    items,
    isLoading,
    error,
    path,
    onPathChange,
    retry,
    onUploadFiles,
    onValidateUpload,
    uploadBatchState,
    cancelUpload,
    clearUploadBatch,
    onCreateFolder,
    onCreateFolderValidate,
    isCreatingFolder,
    onDownloadFiles,
    isDownloading,
    downloadError,
    clearDownloadError,
    onDeleteFiles,
    isDeleting,
    deleteError,
    clearDeleteError,
    uploadEnabled: canWriteCurrentFolder,
    isNewButtonDisabled: !canWriteCurrentFolder,
    disabledNewButtonTooltip,
  };
};
