import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import type {
  DialDeletedItem,
  DialFile,
  DialUploadFileItem,
} from '@epam/ai-dial-ui-kit';
import {
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
  DialFilePermission,
  FileManagerColumnKey,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
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
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import {
  createFolder,
  deleteFiles,
  downloadArchive,
  downloadFile,
  listFiles,
  listPublicFiles,
  listSharedFiles,
  uploadFile,
} from '../../server-api/files.api';
import {
  DownloadDestinationType,
  prepareDownloadDestination,
  triggerBrowserDownload,
} from '../../utils/file-download';
import { sanitizeFileName } from '../../utils/file-name';
import {
  resolveDialFileApiPath,
  virtualPathToApiPath,
} from '../../utils/resolve-dial-file-api-path';
import { safeDecodeURI } from '../../utils/string-utils';

export interface UseDialFileManagerOptions {
  /** DIAL Core bucket to browse (used only for my_files tab). */
  bucket: string;
  /** Display name for the root folder node. Defaults to `'All files'`. */
  rootLabel?: string;
  /** Active tab — drives listing source and per-tab options. Defaults to MyFiles. */
  activeTab?: DialFileManagerTabs;
  /** Called when a file-manager action should surface a toast notification. */
  onNotification?: (notification: FileManagerNotification) => void;
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

  /** Delete: called when user confirms deletion of one or more items. */
  onDeleteFiles: (items: DialDeletedItem[], sourceFolder: string) => void;
  /** True while a delete request is in flight. */
  isDeleting: boolean;

  /** True when the current folder grants WRITE (upload + new folder). */
  uploadEnabled: boolean;
  /** True when Upload/New must be disabled. */
  isNewButtonDisabled: boolean;
  /** Tooltip for disabled New/Upload when `isNewButtonDisabled` is true. */
  disabledNewButtonTooltip: string;

  /** Columns to show in the grid — tab-dependent. */
  visibleColumns: FileManagerColumnKey[];
  /** BCP-47 locale string for date formatting, sourced from i18n.language. */
  dateLocale: string;
  /** Fixed date format options for the UpdatedAt column. */
  dateOptions: Intl.DateTimeFormatOptions;
  /** Action labels for grid/tree/bulk — Delete present only on my_files tab. */
  actionLabels: Partial<Record<DialFileManagerActions, string>>;
  /** Root-level shared item paths, populated only on the Shared tab. */
  sharedWithMeIds: string[] | undefined;
}

interface FileUploadValidationResult {
  valid: boolean;
  message?: string;
}

interface FileManagerNotification {
  variant: NotificationVariant;
  title?: string;
  message: string;
}

const UPLOAD_CONCURRENCY = 3;
const RESERVED_MARKER_NAME = HIDDEN_FILE;

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
};

const COLUMNS_WITHOUT_AUTHOR: FileManagerColumnKey[] = [
  FileManagerColumnKey.Name,
  FileManagerColumnKey.UpdatedAt,
  FileManagerColumnKey.Size,
  FileManagerColumnKey.Actions,
];

const COLUMNS_WITH_AUTHOR: FileManagerColumnKey[] = [
  FileManagerColumnKey.Name,
  FileManagerColumnKey.UpdatedAt,
  FileManagerColumnKey.Size,
  FileManagerColumnKey.Author,
  FileManagerColumnKey.Actions,
];

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

interface SharedRootMeta {
  bucket: string;
  /** DIAL Core URL of the shared root item, e.g. "files/owner-bucket/some-folder/" */
  dialCorePath: string;
}

/** Strip the "files/{bucket}/" prefix from a DIAL Core URL to get the path within the bucket. */
const dialCorePathToRelative = (
  dialCorePath: string,
  bucket: string,
): string => {
  const prefix = `files/${bucket}/`;
  return dialCorePath.startsWith(prefix)
    ? dialCorePath.slice(prefix.length)
    : dialCorePath;
};

/**
 * Resolves the effective bucket and path for a write operation on the Shared tab.
 * For Shared tab items, the first segment of apiPath is the shared root folder name
 * whose owner bucket is stored in sharedRootMeta.
 */
const resolveOwnerCoords = (
  apiPath: string,
  sharedRootMeta: Map<string, SharedRootMeta>,
  fallbackBucket: string,
): { bucket: string; path: string } => {
  if (!apiPath) return { bucket: fallbackBucket, path: apiPath };
  const firstSlash = apiPath.indexOf('/');
  const sharedRootName =
    firstSlash === -1 ? apiPath : apiPath.slice(0, firstSlash);
  const meta = sharedRootMeta.get(sharedRootName);
  if (!meta) return { bucket: fallbackBucket, path: apiPath };
  const rootPathInBucket = dialCorePathToRelative(
    meta.dialCorePath,
    meta.bucket,
  );
  const subPath = firstSlash === -1 ? '' : apiPath.slice(firstSlash + 1);
  return { bucket: meta.bucket, path: rootPathInBucket + subPath };
};

const fetchByTab = (
  tab: DialFileManagerTabs,
  bucket: string,
  folderPath: string,
  sharedRootMeta: Map<string, SharedRootMeta>,
): Promise<{ items: ListFilesItemDto[]; permissions?: string[] }> => {
  if (tab === DialFileManagerTabs.Shared) {
    if (folderPath === '') {
      return listSharedFiles({ path: undefined }).then((res) => ({
        items: res.items,
      }));
    }
    // Navigating inside a shared folder — find the owner bucket from the root meta
    // and call listFiles against their bucket with the correct relative path.
    const firstSlash = folderPath.indexOf('/');
    const sharedRootName =
      firstSlash === -1 ? folderPath : folderPath.slice(0, firstSlash);
    const meta = sharedRootMeta.get(sharedRootName);
    if (meta) {
      const rootPathInBucket = dialCorePathToRelative(
        meta.dialCorePath,
        meta.bucket,
      );
      const subPath = firstSlash === -1 ? '' : folderPath.slice(firstSlash + 1);
      const actualPath = rootPathInBucket + subPath;
      return listFiles({
        bucket: meta.bucket,
        path: actualPath,
        permissions: true,
      }).then((res) => ({ items: res.items, permissions: res.permissions }));
    }
    return Promise.resolve({ items: [] });
  }
  if (tab === DialFileManagerTabs.Organization) {
    return listPublicFiles({ path: folderPath || undefined }).then((res) => ({
      items: res.items,
    }));
  }
  return listFiles({
    bucket,
    path: folderPath,
    permissions: true,
  }).then((res) => ({ items: res.items, permissions: res.permissions }));
};

/**
 * Manages DIAL file-storage browsing state for DialFileManager.
 *
 * Supports three listing sources via `activeTab`:
 * - my_files: user's own bucket via GET /api/v1/files/list
 * - shared: files shared with the user via GET /api/v1/files/shared
 * - organization: public bucket via GET /api/v1/files/public
 *
 * Uses a per-folder cache so navigating into a subfolder does not discard
 * already-loaded sibling folders. The cache is cleared on tab switch.
 */
export const useDialFileManager = ({
  bucket,
  rootLabel = 'All files',
  activeTab = DialFileManagerTabs.MyFiles,
  onNotification,
}: UseDialFileManagerOptions): UseDialFileManagerResult => {
  const { t, i18n } = useTranslation();
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
  const [sharedRootIds, setSharedRootIds] = useState<string[] | undefined>(
    undefined,
  );

  // Maps shared root folder name → { bucket, dialCorePath } for subfolder navigation.
  const sharedRootMetaRef = useRef<Map<string, SharedRootMeta>>(new Map());

  const [uploadBatchState, setUploadBatchState] =
    useState<FileUploadBatchState | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
  }, [activeTab]);

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
          setSharedRootIds(flat.map((item) => item.path));
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
  }, [activeTab, bucket, folderPath, retryCounter]);

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

  const onUploadFiles = useCallback(
    (files: DialUploadFileItem[], destinationFolder: string) => {
      if (files.length === 0) return;

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
      const { bucket: uploadBucket, path: uploadBasePath } =
        activeTab === DialFileManagerTabs.Shared
          ? resolveOwnerCoords(
              destinationApiPath,
              sharedRootMetaRef.current,
              bucket,
            )
          : { bucket, path: destinationApiPath };

      const cachedNames = new Set(
        (cache.get(destinationApiPath) ?? []).map((item) =>
          item.name.toLowerCase(),
        ),
      );

      const processBatch = async () => {
        let nextIndex = 0;
        let successCount = 0;
        let failedCount = 0;

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

            const uploadMode = cachedNames.has(file.name.toLowerCase())
              ? 'overwrite'
              : 'create-only';

            try {
              await uploadFile(
                uploadBucket,
                `${uploadBasePath}${file.name}`,
                file.fileContent,
                {
                  signal: controller.signal,
                  uploadMode,
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
              successCount += 1;
            } catch {
              const status = controller.signal.aborted
                ? FileUploadStatus.Cancelled
                : FileUploadStatus.Failed;
              if (status === FileUploadStatus.Failed) {
                failedCount += 1;
              }
              setUploadBatchState((prev) => updateEntry(prev, i, status));
            }
          }
        };

        await Promise.all(
          Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()),
        );

        if (!controller.signal.aborted) {
          if (successCount === 0 && failedCount > 0) {
            onNotification?.({
              variant: NotificationVariant.Error,
              title: t(DialFileManagerI18nKeys.UploadFailed),
              message: t(DialFileManagerI18nKeys.CheckInternetConnection),
            });
          } else {
            onNotification?.({
              variant: NotificationVariant.Success,
              message: t(DialFileManagerI18nKeys.UploadSuccess, {
                parentPath: uploadBasePath || rootLabel,
              }),
            });
          }
        }

        setCache((prev) => {
          const next = new Map(prev);
          next.delete(destinationApiPath);
          return next;
        });
        setRetryCounter((c) => c + 1);
        uploadAbortControllerRef.current = null;
        setUploadBatchState(null);
      };

      void processBatch();
    },
    [activeTab, bucket, cache, rootLabel, onNotification, t],
  );

  const onValidateUpload = useCallback(
    async (
      files: DialUploadFileItem[],
      _existingFiles: DialFile[],
      _destinationFolder: string,
    ): Promise<FileUploadValidationResult> => {
      for (const file of files) {
        file.name = sanitizeFileName(file.name);
      }
      return { valid: true };
    },
    [],
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
      const { bucket: targetBucket, path: targetParentPath } =
        activeTab === DialFileManagerTabs.Shared
          ? resolveOwnerCoords(parentApiPath, sharedRootMetaRef.current, bucket)
          : { bucket, path: parentApiPath };
      try {
        const created = await createFolder({
          bucket: targetBucket,
          parentPath: targetParentPath || undefined,
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
        setRetryCounter((c) => c + 1);
      } catch {
        onNotification?.({
          variant: NotificationVariant.Error,
          message: t(DialFileManagerI18nKeys.FolderCreateError),
        });
      } finally {
        setIsCreatingFolder(false);
      }
    },
    [activeTab, bucket, rootLabel, listingPermissionsCache, onNotification, t],
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
            if (!file.bucket) {
              throw new Error('File is missing bucket');
            }
            const filePath = resolveDialFileApiPath(
              file,
              file.bucket,
              rootLabel,
            );
            const response = await downloadFile(file.bucket, filePath);
            if (!response.ok) {
              throw new Error(`Download failed with status ${response.status}`);
            }
            await triggerBrowserDownload(response, file.name, destination);
          } else {
            const archiveItems = dialFiles.map((f) => ({
              bucket: f.bucket ?? bucket,
              path: resolveDialFileApiPath(f, f.bucket ?? bucket, rootLabel),
              name: f.name,
              nodeType:
                f.nodeType === DialFileNodeType.FOLDER
                  ? ArchiveItemDtoNodeTypeEnum.Folder
                  : ArchiveItemDtoNodeTypeEnum.Item,
            }));
            const response = await downloadArchive(archiveItems);
            if (!response.ok) {
              throw new Error(`Download failed with status ${response.status}`);
            }
            await triggerBrowserDownload(response, filename, destination);
          }
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            message: t(
              dialFiles.length === 1
                ? DialFileManagerI18nKeys.DownloadFileError
                : DialFileManagerI18nKeys.DownloadFilesError,
            ),
          });
        } finally {
          setIsDownloading(false);
        }
      };
      void run();
    },
    [bucket, rootLabel, onNotification, t],
  );

  const onDeleteFiles = useCallback(
    (deletedItems: DialDeletedItem[], sourceFolder: string) => {
      if (deletedItems.length === 0) return;

      const run = async () => {
        setIsDeleting(true);

        const dtos: DeleteItemDto[] = deletedItems.map((item) => {
          const isFolder = item.nodeType === DialFileNodeType.FOLDER;
          const apiPath = virtualPathToApiPath(item.sourceUrl, rootLabel);
          const relPath = isFolder ? apiPath : apiPath.replace(/\/$/, '');
          const segments = item.sourceUrl.split('/').filter(Boolean);
          const name = segments[segments.length - 1] ?? relPath;
          const { bucket: itemBucket, path: itemPath } =
            activeTab === DialFileManagerTabs.Shared
              ? resolveOwnerCoords(relPath, sharedRootMetaRef.current, bucket)
              : { bucket, path: relPath };
          return {
            bucket: itemBucket,
            path: itemPath,
            name,
            nodeType: isFolder
              ? DeleteItemDtoNodeTypeEnum.Folder
              : DeleteItemDtoNodeTypeEnum.Item,
          };
        });

        try {
          const { results } = await deleteFiles(dtos);
          const failedResults = results.filter((r) => !r.success);
          const failedCount = failedResults.length;
          const successCount = results.length - failedCount;
          const firstSuccessfulResult = results.find(
            (result) => result.success,
          );
          const firstSuccessfulDto =
            dtos.find((item) => item.path === firstSuccessfulResult?.path) ??
            dtos[0];

          if (successCount > 0) {
            onNotification?.({
              variant: NotificationVariant.Success,
              title: t(
                successCount === 1
                  ? DialFileManagerI18nKeys.ItemDeletedSuccessfully
                  : DialFileManagerI18nKeys.ItemsDeletedSuccessfully,
              ),
              message: t(
                successCount === 1
                  ? DialFileManagerI18nKeys.ItemDeletedFromFolder
                  : DialFileManagerI18nKeys.ItemsDeletedFromFolder,
                {
                  count: successCount,
                  fileName: firstSuccessfulDto?.name,
                  folder: sourceFolder || rootLabel,
                },
              ),
            });
          }

          if (failedCount > 0) {
            const failedNames = failedResults.slice(0, 3).map((result) => {
              const failedDto = dtos.find((item) => item.path === result.path);
              return failedDto?.name ?? result.path;
            });
            const restCount = failedCount - failedNames.length;

            onNotification?.({
              variant: NotificationVariant.Error,
              title: t(DialFileManagerI18nKeys.ItemsDeletingFailed),
              message: t(DialFileManagerI18nKeys.SomeItemsNotDeleted, {
                files: failedNames.join(', '),
                rest:
                  restCount > 0
                    ? t(DialFileManagerI18nKeys.AndOtherItems, {
                        count: restCount,
                      })
                    : '',
              }),
            });
          }
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            message: t(DialFileManagerI18nKeys.DeleteFilesError),
          });
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
    [activeTab, bucket, rootLabel, t, folderPath, onNotification],
  );

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

  const uploadEnabled = useMemo((): boolean => {
    if (activeTab === DialFileManagerTabs.Organization) return false;
    if (activeTab === DialFileManagerTabs.Shared && folderPath === '') {
      return false;
    }
    return canWriteCurrentFolder;
  }, [activeTab, folderPath, canWriteCurrentFolder]);

  const visibleColumns = useMemo(
    (): FileManagerColumnKey[] =>
      activeTab === DialFileManagerTabs.Shared
        ? COLUMNS_WITH_AUTHOR
        : COLUMNS_WITHOUT_AUTHOR,
    [activeTab],
  );

  const actionLabels = useMemo(
    (): Partial<Record<DialFileManagerActions, string>> =>
      activeTab === DialFileManagerTabs.MyFiles
        ? {
            [DialFileManagerActions.Download]: t('dialFileManager.download'),
            [DialFileManagerActions.Delete]: t('dialFileManager.deleteAction'),
          }
        : {
            [DialFileManagerActions.Download]: t('dialFileManager.download'),
          },
    [activeTab, t],
  );

  const sharedWithMeIds = useMemo(
    (): string[] | undefined =>
      activeTab === DialFileManagerTabs.Shared ? sharedRootIds : undefined,
    [activeTab, sharedRootIds],
  );

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
    onDeleteFiles,
    isDeleting,
    uploadEnabled,
    isNewButtonDisabled: !uploadEnabled,
    disabledNewButtonTooltip,
    visibleColumns,
    dateLocale: i18n.language,
    dateOptions: DATE_OPTIONS,
    actionLabels,
    sharedWithMeIds,
  };
};
