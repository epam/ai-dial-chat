import type {
  ArchiveItemDto,
  CreateFolderResponseDto,
  DeleteItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ArchiveItemDtoNodeTypeEnum,
  DeleteItemDtoNodeTypeEnum,
  RenameItemDtoNodeTypeEnum,
} from '@epam/ai-dial-chat-api-client';
import type {
  DialCopiedItem,
  DialDeletedItem,
  DialFile,
  DialUploadFileItem,
} from '@epam/ai-dial-react-file-manager';
import {
  DialFileManagerTabs,
  DialFileNodeType,
} from '@epam/ai-dial-react-file-manager';
import { NOT_ALLOWED_SYMBOLS, NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useRef, useState } from 'react';
import {
  prepareCopyItems,
  prepareMoveRenameItems,
} from '../dial-file-manager-copy-move.util';
import { findFirstSuccessfulCopyMoveItem } from '../dial-file-manager-mapping.util';
import {
  formatOperationFolderName,
  getVirtualPathName,
  hasForbiddenNameSymbols,
  parseNewFolderVirtualPath,
  resolveOwnerCoords,
} from '../dial-file-manager-path.util';
import {
  RESERVED_MARKER_NAME,
  type SharedRootMeta,
} from '../dial-file-manager.model';
import type {
  FileManagerNotification,
  FileNameValidationError,
  FileOperationSuccessEvent,
} from '../dial-file-manager.types';
import {
  FileManagerNotificationReason,
  FileNameValidationErrorReason,
  FileOperationKind,
} from '../dial-file-manager.types';
import type { DialFilesApi } from '../dial-files-api';
import { DownloadDestinationType } from '../download-destination';
import type { DownloadDestinationHandlers } from '../download-destination';
import {
  getParentFolderPath,
  resolveDialFileApiPath,
  virtualPathToApiPath,
} from '../resolve-dial-file-api-path';

/** Options accepted by `useDialFileMutations`. */
export interface UseDialFileMutationsOptions {
  /** Injected operation port used for every mutation network call. */
  filesApi: DialFilesApi;
  /** DIAL Core bucket to browse (used only for the my_files tab). */
  bucket: string;
  /** Display name for the root folder node. */
  rootLabel: string;
  /** Active tab — drives owner-bucket resolution for the Shared tab. */
  activeTab: DialFileManagerTabs;
  /** Bucket-relative path of the currently browsed folder, owned by `useDialFileListing`. */
  folderPath: string;
  /** Currently browsed folder node, owned by `useDialFileListing`. */
  currentFolder: DialFile | undefined;
  /** Owner-bucket resolution metadata for the Shared tab, owned by `useDialFileListing`. */
  sharedRootMetaRef: React.RefObject<Map<string, SharedRootMeta>>;
  /** Read-only snapshot of `useDialFileListing`'s per-folder permissions cache. */
  listingPermissionsCache: Map<string, string[] | undefined>;
  /** Deletes the given API-path cache keys so the next fetch re-fetches them. */
  invalidateFolders: (apiPaths: string[]) => void;
  /** Forces `useDialFileListing`'s fetch effect to re-run. */
  bumpRetry: () => void;
  /** Merges a newly created folder into its parent's cache entry, owned by `useDialFileListing`. */
  mergeCreatedFolder: (
    parentApiPath: string,
    created: CreateFolderResponseDto,
    inheritedPermissions?: string[],
  ) => void;
  /** Imperatively navigates the current folder after a rename/delete of the browsed folder. */
  setFolderPath: React.Dispatch<React.SetStateAction<string>>;
  /** Called when a mutation should surface a toast notification. */
  onNotification?: (notification: FileManagerNotification) => void;
  /** Called when a mutation succeeds, instead of invoking an application notification service directly. */
  onOperationSuccess?: (event: FileOperationSuccessEvent) => void;
  /** Host-injected browser "Save As"/auto-download seam for `onDownloadFiles`. */
  downloadDestination: DownloadDestinationHandlers;
  /** Regexp of characters forbidden in file/folder names beyond the path separator. */
  forbiddenSymbolsRegExp?: RegExp;
}

/** Values returned by `useDialFileMutations`. */
export interface UseDialFileMutationsResult {
  isCreatingFolder: boolean;
  isDownloading: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  isCopying: boolean;
  isMoving: boolean;
  onCreateFolder: (
    file: DialUploadFileItem,
    folderPath: string,
    fileId: string,
  ) => Promise<void>;
  onCreateFolderValidate: (
    name: string,
    parentFolder: DialFile,
  ) => FileNameValidationError | null;
  onDownloadFiles: (dialFiles: DialFile[]) => void;
  onDeleteFiles: (items: DialDeletedItem[], sourceFolder: string) => void;
  onRenameValidate: (
    value: string,
    item: DialFile,
  ) => FileNameValidationError | null;
  onMoveToFiles: (
    items: DialCopiedItem[],
    sourceFolder: string,
    destinationFolder: string,
  ) => void;
  onCopyFiles: (items: DialCopiedItem[], destinationFolder: string) => void;
  cancelCopyMove: () => void;
}

/**
 * Manages create-folder, download, delete, rename, copy, and move mutations.
 * Every mutation invalidates the shared listing cache for its affected
 * folders through `invalidateFolders`/`bumpRetry` rather than holding its own
 * cache copy; create-folder additionally uses `mergeCreatedFolder` so a newly
 * created folder appears immediately even when created from a
 * destination-folder popup browsing a different folder than the outer grid.
 */
export const useDialFileMutations = ({
  filesApi,
  bucket,
  rootLabel,
  activeTab,
  folderPath,
  currentFolder,
  sharedRootMetaRef,
  listingPermissionsCache,
  invalidateFolders,
  bumpRetry,
  mergeCreatedFolder,
  setFolderPath,
  onNotification,
  onOperationSuccess,
  downloadDestination,
  forbiddenSymbolsRegExp,
}: UseDialFileMutationsOptions): UseDialFileMutationsResult => {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const copyMoveAbortControllerRef = useRef<AbortController | null>(null);

  /*
   * The host `DialFileManager` grid shows this validation result inline
   * while the user types but does not reliably gate its own `onCreateFolder`
   * confirm callback on it — and the name it eventually passes to
   * `onCreateFolder` is derived by splitting a constructed virtual path on
   * '/', which silently swallows an embedded '/' the user typed as if it
   * were a path separator (see #7968). Track the last live-typed validation
   * result here so `onCreateFolder` can refuse even when the value it
   * receives no longer reflects that error.
   */
  const lastLiveValidationErrorRef = useRef<FileNameValidationError | null>(
    null,
  );

  const onCreateFolderValidate = useCallback(
    (name: string, parentFolder: DialFile): FileNameValidationError | null => {
      let error: FileNameValidationError | null = null;
      if (!name || name.trim() === '') {
        error = { reason: FileNameValidationErrorReason.Empty };
      } else if (hasForbiddenNameSymbols(name, forbiddenSymbolsRegExp)) {
        error = {
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
          symbols: NOT_ALLOWED_SYMBOLS,
        };
      } else if (name.startsWith('.')) {
        error = { reason: FileNameValidationErrorReason.LeadingDot };
      } else if (name === RESERVED_MARKER_NAME) {
        error = { reason: FileNameValidationErrorReason.ReservedName };
      } else if (name.length > 255) {
        error = {
          reason: FileNameValidationErrorReason.TooLong,
          maxLength: 255,
        };
      } else {
        const siblings = parentFolder.items ?? [];
        const lowerName = name.toLowerCase();
        const matched = siblings.find(
          (s) => s.name.toLowerCase() === lowerName,
        );
        if (matched) {
          error = {
            reason: FileNameValidationErrorReason.DuplicateName,
            existingName: matched.name,
          };
        }
      }
      lastLiveValidationErrorRef.current = error;
      return error;
    },
    [forbiddenSymbolsRegExp],
  );

  const onCreateFolder = useCallback(
    async (
      _file: DialUploadFileItem,
      newFolderPath: string,
      _fileId: string,
    ): Promise<void> => {
      const { parentVirtualPath, name } = parseNewFolderVirtualPath(
        newFolderPath,
        rootLabel,
      );
      const parentApiPath = virtualPathToApiPath(parentVirtualPath, rootLabel);

      const parentFolder: DialFile =
        currentFolder && folderPath === parentApiPath
          ? currentFolder
          : {
              id: parentApiPath,
              path: parentApiPath,
              name: parentVirtualPath.split('/').filter(Boolean).pop() ?? '',
              folderId: parentApiPath,
              nodeType: DialFileNodeType.FOLDER,
              items: [],
            };

      // Captured before re-validating below, which overwrites the ref.
      const priorLiveError = lastLiveValidationErrorRef.current;
      lastLiveValidationErrorRef.current = null;

      if (onCreateFolderValidate(name, parentFolder) || priorLiveError) return;

      setIsCreatingFolder(true);
      const { bucket: targetBucket, path: targetParentPath } =
        activeTab === DialFileManagerTabs.Shared
          ? resolveOwnerCoords(parentApiPath, sharedRootMetaRef.current, bucket)
          : { bucket, path: parentApiPath };
      try {
        const created = await filesApi.createFolder({
          bucket: targetBucket,
          parentPath: targetParentPath || undefined,
          name,
        });
        mergeCreatedFolder(
          parentApiPath,
          created,
          listingPermissionsCache.get(parentApiPath),
        );
        bumpRetry();
        onOperationSuccess?.({ kind: FileOperationKind.FolderCreated, name });
      } catch {
        onNotification?.({
          variant: NotificationVariant.Error,
          reason: FileManagerNotificationReason.FolderCreateFailed,
        });
      } finally {
        setIsCreatingFolder(false);
      }
    },
    [
      activeTab,
      bucket,
      currentFolder,
      filesApi,
      folderPath,
      onCreateFolderValidate,
      rootLabel,
      listingPermissionsCache,
      mergeCreatedFolder,
      bumpRetry,
      onOperationSuccess,
      sharedRootMetaRef,
      onNotification,
    ],
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
          const destination = await downloadDestination.resolveDestination(
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
            const response = await filesApi.downloadFile(file.bucket, filePath);
            if (!response.ok) {
              throw new Error(`Download failed with status ${response.status}`);
            }
            const savedName = await downloadDestination.triggerDownload(
              response,
              file.name,
              destination,
            );
            onOperationSuccess?.({
              kind: FileOperationKind.FileDownloaded,
              name: savedName,
              count: 1,
            });
          } else {
            const archiveItems: ArchiveItemDto[] = dialFiles.map((f) => ({
              bucket: f.bucket ?? bucket,
              path: resolveDialFileApiPath(f, f.bucket ?? bucket, rootLabel),
              name: f.name,
              nodeType:
                f.nodeType === DialFileNodeType.FOLDER
                  ? ArchiveItemDtoNodeTypeEnum.Folder
                  : ArchiveItemDtoNodeTypeEnum.Item,
            }));
            const response = await filesApi.downloadArchive(archiveItems);
            if (!response.ok) {
              throw new Error(`Download failed with status ${response.status}`);
            }
            const savedName = await downloadDestination.triggerDownload(
              response,
              filename,
              destination,
            );
            /*
             * A lone folder is reported as a name-only event; a multi-item
             * selection is reported as a count only, since the archive
             * itself is not an entity the user picked.
             */
            if (dialFiles.length === 1) {
              onOperationSuccess?.({
                kind: FileOperationKind.FileDownloaded,
                name: savedName,
              });
            } else {
              onOperationSuccess?.({
                kind: FileOperationKind.FilesDownloaded,
                count: dialFiles.length,
              });
            }
          }
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            reason:
              dialFiles.length === 1
                ? FileManagerNotificationReason.DownloadFileFailed
                : FileManagerNotificationReason.DownloadFilesFailed,
          });
        } finally {
          setIsDownloading(false);
        }
      };
      void run();
    },
    [
      bucket,
      rootLabel,
      onOperationSuccess,
      onNotification,
      filesApi,
      downloadDestination,
    ],
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
          const name = getVirtualPathName(item.sourceUrl, relPath);
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
          const { results } = await filesApi.deleteFiles(dtos);
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
              reason: FileManagerNotificationReason.FilesDeleted,
              count: successCount,
              name: firstSuccessfulDto?.name,
              folder: sourceFolder || rootLabel,
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
              reason: FileManagerNotificationReason.FilesDeletePartiallyFailed,
              names: failedNames,
              restCount,
            });
          }
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.DeleteFailed,
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

        invalidateFolders([...affectedFolderKeys]);

        const isCurrentFolderDeleted = deletedFolderPaths.some(
          (fp) => folderPath === fp || folderPath.startsWith(fp),
        );
        if (isCurrentFolderDeleted) {
          setFolderPath((prev) => prev.replace(/[^/]+\/$/, ''));
        }

        bumpRetry();
        setIsDeleting(false);
      };
      void run();
    },
    [
      activeTab,
      bucket,
      rootLabel,
      folderPath,
      onNotification,
      filesApi,
      sharedRootMetaRef,
      invalidateFolders,
      bumpRetry,
      setFolderPath,
    ],
  );

  const onRenameValidate = useCallback(
    (value: string, item: DialFile): FileNameValidationError | null => {
      if (!value || value.trim() === '') {
        return { reason: FileNameValidationErrorReason.Empty };
      }
      if (value === RESERVED_MARKER_NAME) {
        return { reason: FileNameValidationErrorReason.ReservedName };
      }
      if (hasForbiddenNameSymbols(value, forbiddenSymbolsRegExp)) {
        return {
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
          symbols: NOT_ALLOWED_SYMBOLS,
        };
      }
      if (value.length > 255) {
        return {
          reason: FileNameValidationErrorReason.TooLong,
          maxLength: 255,
        };
      }
      const siblings = currentFolder?.items ?? [];
      const lowerValue = value.toLowerCase();
      const matched = siblings.find(
        (s) => s.path !== item.path && s.name.toLowerCase() === lowerValue,
      );
      if (matched) {
        return {
          reason: FileNameValidationErrorReason.DuplicateName,
          existingName: matched.name,
        };
      }
      return null;
    },
    [forbiddenSymbolsRegExp, currentFolder],
  );

  const onCopyFiles = useCallback(
    (copiedItems: DialCopiedItem[], destinationFolder: string) => {
      if (copiedItems.length === 0 || isCopying || isMoving) return;

      const controller = new AbortController();
      copyMoveAbortControllerRef.current = controller;

      const run = async () => {
        setIsCopying(true);

        const preparedItems = prepareCopyItems(copiedItems, bucket, rootLabel);
        const dtos = preparedItems.map(({ dto }) => dto);

        try {
          const { results } = await filesApi.copyFiles(dtos, controller.signal);
          const failedCount = results.filter((r) => !r.success).length;
          const successCount = results.length - failedCount;

          if (successCount > 0) {
            const firstSuccessfulItem = findFirstSuccessfulCopyMoveItem(
              preparedItems,
              results,
            );

            onOperationSuccess?.({
              kind:
                successCount === 1
                  ? FileOperationKind.FileCopied
                  : FileOperationKind.FilesCopied,
              name: firstSuccessfulItem?.destinationName,
              count: successCount,
              destinationFolderName: formatOperationFolderName(
                destinationFolder,
                rootLabel,
              ),
            });
          }

          if (failedCount > 0 && failedCount < results.length) {
            onNotification?.({
              variant: NotificationVariant.Error,
              reason: FileManagerNotificationReason.CopyPartiallyFailed,
              count: failedCount,
            });
          } else if (failedCount === results.length) {
            onNotification?.({
              variant: NotificationVariant.Error,
              reason: FileManagerNotificationReason.CopyFailed,
            });
          }
        } catch {
          if (!controller.signal.aborted) {
            onNotification?.({
              variant: NotificationVariant.Error,
              reason: FileManagerNotificationReason.CopyFailed,
            });
          }
        } finally {
          const affectedKeys = new Set(
            dtos.flatMap((dto) => [
              getParentFolderPath(dto.sourcePath),
              getParentFolderPath(dto.destinationPath),
            ]),
          );

          invalidateFolders([...affectedKeys]);
          bumpRetry();
          setIsCopying(false);
          copyMoveAbortControllerRef.current = null;
        }
      };

      void run();
    },
    [
      bucket,
      rootLabel,
      onNotification,
      onOperationSuccess,
      filesApi,
      isCopying,
      isMoving,
      invalidateFolders,
      bumpRetry,
    ],
  );

  const cancelCopyMove = useCallback(() => {
    copyMoveAbortControllerRef.current?.abort();
  }, []);

  const onMoveToFiles = useCallback(
    (
      copiedItems: DialCopiedItem[],
      _sourceFolder: string,
      destinationFolder: string,
    ) => {
      if (copiedItems.length === 0 || isCopying || isMoving || isRenaming) {
        return;
      }

      const { renameDtos, preparedMoveItems } = prepareMoveRenameItems(
        copiedItems,
        bucket,
        rootLabel,
      );
      const moveDtos = preparedMoveItems.map(({ dto }) => dto);

      const controller = new AbortController();
      if (moveDtos.length > 0) {
        copyMoveAbortControllerRef.current = controller;
      }

      const run = async () => {
        if (renameDtos.length > 0) setIsRenaming(true);
        if (moveDtos.length > 0) setIsMoving(true);

        const runRename = async (): Promise<{
          results: Awaited<ReturnType<DialFilesApi['renameFiles']>>['results'];
          threw: boolean;
        }> => {
          if (renameDtos.length === 0) return { results: [], threw: false };
          try {
            const { results } = await filesApi.renameFiles(renameDtos);
            return { results, threw: false };
          } catch {
            return { results: [], threw: true };
          }
        };

        const runMove = async (): Promise<{
          results: Awaited<ReturnType<DialFilesApi['moveFiles']>>['results'];
          threw: boolean;
          aborted: boolean;
        }> => {
          if (moveDtos.length === 0) {
            return { results: [], threw: false, aborted: false };
          }
          try {
            const { results } = await filesApi.moveFiles(
              moveDtos,
              controller.signal,
            );
            return { results, threw: false, aborted: false };
          } catch {
            return {
              results: [],
              threw: true,
              aborted: controller.signal.aborted,
            };
          }
        };

        const [renameOutcome, moveOutcome] = await Promise.all([
          runRename(),
          runMove(),
        ]);

        const renameFailedCount = renameOutcome.threw
          ? renameDtos.length
          : renameOutcome.results.filter((r) => !r.success).length;
        const moveWasAborted = moveOutcome.threw && moveOutcome.aborted;
        const moveTotal = moveWasAborted ? 0 : moveDtos.length;
        const moveFailedCount = moveWasAborted
          ? 0
          : moveOutcome.threw
            ? moveDtos.length
            : moveOutcome.results.filter((r) => !r.success).length;
        const moveSuccessCount = moveOutcome.threw
          ? 0
          : moveOutcome.results.filter((r) => r.success).length;

        const totalCount = renameDtos.length + moveTotal;
        const totalFailed = renameFailedCount + moveFailedCount;
        const useMoveCopy = moveFailedCount > 0;

        if (moveSuccessCount > 0) {
          const firstSuccessfulItem = findFirstSuccessfulCopyMoveItem(
            preparedMoveItems,
            moveOutcome.results,
          );

          onOperationSuccess?.({
            kind:
              moveSuccessCount === 1
                ? FileOperationKind.FileMoved
                : FileOperationKind.FilesMoved,
            name: firstSuccessfulItem?.destinationName,
            count: moveSuccessCount,
            destinationFolderName: formatOperationFolderName(
              destinationFolder,
              rootLabel,
            ),
          });
        }

        /*
         * Renaming from the grid is always a single item, so a fully successful
         * single rename is confirmed by name. A multi-item rename batch — which
         * the UI cannot produce today — stays silent rather than claiming a name
         * that only covers part of the batch.
         */
        if (renameDtos.length === 1 && renameFailedCount === 0) {
          const [renamedDto] = renameDtos;
          onOperationSuccess?.({
            kind: FileOperationKind.FileRenamed,
            name: getVirtualPathName(
              renamedDto.destinationPath,
              renamedDto.destinationPath,
            ),
            isFolder: renamedDto.nodeType === RenameItemDtoNodeTypeEnum.Folder,
          });
        }

        if (totalFailed > 0) {
          if (totalFailed === totalCount) {
            onNotification?.({
              variant: NotificationVariant.Error,
              reason: useMoveCopy
                ? FileManagerNotificationReason.MoveFailed
                : FileManagerNotificationReason.RenameFailed,
            });
          } else {
            onNotification?.({
              variant: NotificationVariant.Error,
              reason: useMoveCopy
                ? FileManagerNotificationReason.MovePartiallyFailed
                : FileManagerNotificationReason.RenamePartiallyFailed,
              count: totalFailed,
            });
          }
        }

        // Navigate away if the current folder was renamed successfully.
        const renamedFolderDto = renameDtos.find(
          (dto) =>
            dto.nodeType === RenameItemDtoNodeTypeEnum.Folder &&
            renameOutcome.results.some(
              (result) =>
                result.success && result.sourcePath === dto.sourcePath,
            ),
        );
        if (renamedFolderDto != null) {
          const srcPrefix = renamedFolderDto.sourcePath.endsWith('/')
            ? renamedFolderDto.sourcePath
            : `${renamedFolderDto.sourcePath}/`;
          if (folderPath === srcPrefix || folderPath.startsWith(srcPrefix)) {
            const destPrefix = renamedFolderDto.destinationPath.endsWith('/')
              ? renamedFolderDto.destinationPath
              : `${renamedFolderDto.destinationPath}/`;
            setFolderPath(folderPath.replace(srcPrefix, destPrefix));
          }
        }

        const affectedKeys = new Set(
          [...renameDtos, ...moveDtos].flatMap((dto) => [
            getParentFolderPath(dto.sourcePath),
            getParentFolderPath(dto.destinationPath),
          ]),
        );

        invalidateFolders([...affectedKeys]);
        bumpRetry();
        setIsRenaming(false);
        setIsMoving(false);
        if (moveDtos.length > 0) {
          copyMoveAbortControllerRef.current = null;
        }
      };

      void run();
    },
    [
      bucket,
      rootLabel,
      folderPath,
      onOperationSuccess,
      onNotification,
      filesApi,
      isCopying,
      isMoving,
      isRenaming,
      invalidateFolders,
      bumpRetry,
      setFolderPath,
    ],
  );

  return {
    isCreatingFolder,
    isDownloading,
    isDeleting,
    isRenaming,
    isCopying,
    isMoving,
    onCreateFolder,
    onCreateFolderValidate,
    onDownloadFiles,
    onDeleteFiles,
    onRenameValidate,
    onMoveToFiles,
    onCopyFiles,
    cancelCopyMove,
  };
};
