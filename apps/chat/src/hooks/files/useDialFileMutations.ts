import type {
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
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import {
  copyFiles,
  createFolder,
  deleteFiles,
  downloadArchive,
  downloadFile,
  moveFiles,
  renameFiles,
} from '../../server-api/files.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import {
  DownloadDestinationType,
  prepareDownloadDestination,
  triggerBrowserDownload,
} from '../../utils/file-download';
import {
  getParentFolderPath,
  resolveDialFileApiPath,
  virtualPathToApiPath,
} from '../../utils/resolve-dial-file-api-path';
import { useOperationNotification } from '../useOperationNotification';
import {
  prepareCopyItems,
  prepareMoveRenameItems,
} from './dial-file-manager-copy-move.util';
import { findFirstSuccessfulCopyMoveItem } from './dial-file-manager-mapping.util';
import {
  formatOperationFolderName,
  getVirtualPathName,
  hasForbiddenNameSymbols,
  parseNewFolderVirtualPath,
  resolveOwnerCoords,
} from './dial-file-manager-path.util';
import {
  RESERVED_MARKER_NAME,
  type SharedRootMeta,
} from './dial-file-manager.model';

export interface UseDialFileMutationsOptions {
  bucket: string;
  rootLabel: string;
  activeTab: DialFileManagerTabs;
  /** Bucket-relative path of the currently browsed folder, owned by `useDialFileListing`. */
  folderPath: string;
  currentFolder: DialFile | undefined;
  sharedRootMetaRef: React.RefObject<Map<string, SharedRootMeta>>;
  listingPermissionsCache: Map<string, string[] | undefined>;
  invalidateFolders: (apiPaths: string[]) => void;
  bumpRetry: () => void;
  /** Merges a newly created folder into its parent's cache entry, owned by `useDialFileListing`. */
  mergeCreatedFolder: (
    parentApiPath: string,
    created: CreateFolderResponseDto,
    inheritedPermissions?: string[],
  ) => void;
  setFolderPath: React.Dispatch<React.SetStateAction<string>>;
  onNotification?: (notification: {
    variant: NotificationVariant;
    title?: string;
    message: string;
  }) => void;
  forbiddenSymbolsRegExp?: RegExp;
}

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
  ) => string | null;
  onDownloadFiles: (dialFiles: DialFile[]) => void;
  onDeleteFiles: (items: DialDeletedItem[], sourceFolder: string) => void;
  onRenameValidate: (value: string, item: DialFile) => string | null;
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
 * folders through `invalidateFolders`/`bumpRetry` (design.md D1) rather than
 * holding its own cache copy; create-folder additionally uses
 * `mergeCreatedFolder` so a newly created folder appears immediately even when
 * created from a destination-folder popup browsing a different folder than
 * the outer grid.
 */
export const useDialFileMutations = ({
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
  forbiddenSymbolsRegExp,
}: UseDialFileMutationsOptions): UseDialFileMutationsResult => {
  const { t } = useTranslation();
  const { notifyOperationSuccess } = useOperationNotification();

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
  const lastLiveValidationErrorRef = useRef<string | null>(null);

  const onCreateFolderValidate = useCallback(
    (name: string, parentFolder: DialFile): string | null => {
      let error: string | null = null;
      if (!name || name.trim() === '') {
        error = t('dialFileManager.folderNameEmpty');
      } else if (hasForbiddenNameSymbols(name, forbiddenSymbolsRegExp)) {
        error = t(DialFileManagerI18nKeys.FolderNameInvalidChars, {
          notAllowedSymbols: NOT_ALLOWED_SYMBOLS,
        });
      } else if (name.startsWith('.')) {
        error = t('dialFileManager.folderNameHidden');
      } else if (name === RESERVED_MARKER_NAME) {
        error = t('dialFileManager.folderNameReserved');
      } else if (name.length > 255) {
        error = t('dialFileManager.folderNameTooLong');
      } else {
        const siblings = parentFolder.items ?? [];
        const lowerName = name.toLowerCase();
        if (siblings.some((s) => s.name.toLowerCase() === lowerName)) {
          error = t('dialFileManager.folderConflict');
        }
      }
      lastLiveValidationErrorRef.current = error;
      return error;
    },
    [t, forbiddenSymbolsRegExp],
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
        const created = await createFolder({
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
        notifyOperationSuccess(
          NotifiableEntity.Folder,
          EntityOperation.Created,
          { name },
        );
      } catch {
        onNotification?.({
          variant: NotificationVariant.Error,
          message: t(DialFileManagerI18nKeys.FolderCreateError),
        });
      } finally {
        setIsCreatingFolder(false);
      }
    },
    [
      activeTab,
      bucket,
      currentFolder,
      folderPath,
      onCreateFolderValidate,
      rootLabel,
      listingPermissionsCache,
      mergeCreatedFolder,
      bumpRetry,
      notifyOperationSuccess,
      sharedRootMetaRef,
      onNotification,
      t,
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
            const savedName = await triggerBrowserDownload(
              response,
              file.name,
              destination,
            );
            notifyOperationSuccess(
              NotifiableEntity.File,
              EntityOperation.Downloaded,
              { name: savedName },
            );
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
            const savedName = await triggerBrowserDownload(
              response,
              filename,
              destination,
            );
            notifyOperationSuccess(
              NotifiableEntity.Folder,
              EntityOperation.Downloaded,
              { name: savedName },
            );
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
    [bucket, rootLabel, notifyOperationSuccess, onNotification, t],
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
      t,
      folderPath,
      onNotification,
      sharedRootMetaRef,
      invalidateFolders,
      bumpRetry,
      setFolderPath,
    ],
  );

  const onRenameValidate = useCallback(
    (value: string, item: DialFile): string | null => {
      if (!value || value.trim() === '') {
        return t(DialFileManagerI18nKeys.RenameNameEmpty);
      }
      if (value === RESERVED_MARKER_NAME) {
        return t(DialFileManagerI18nKeys.RenameReservedName);
      }
      if (hasForbiddenNameSymbols(value, forbiddenSymbolsRegExp)) {
        return t(
          item.nodeType === DialFileNodeType.FOLDER
            ? DialFileManagerI18nKeys.FolderNameInvalidChars
            : DialFileManagerI18nKeys.ForbiddenSymbolsTooltip,
          { notAllowedSymbols: NOT_ALLOWED_SYMBOLS },
        );
      }
      if (value.length > 255) {
        return t(DialFileManagerI18nKeys.RenameNameTooLong);
      }
      const siblings = currentFolder?.items ?? [];
      const lowerValue = value.toLowerCase();
      if (
        siblings.some(
          (s) => s.path !== item.path && s.name.toLowerCase() === lowerValue,
        )
      ) {
        return t(DialFileManagerI18nKeys.RenameDuplicateName);
      }
      return null;
    },
    [t, forbiddenSymbolsRegExp, currentFolder],
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
          const { results } = await copyFiles(dtos, controller.signal);
          const failedCount = results.filter((r) => !r.success).length;
          const successCount = results.length - failedCount;

          if (successCount > 0) {
            const firstSuccessfulItem = findFirstSuccessfulCopyMoveItem(
              preparedItems,
              results,
            );

            onNotification?.({
              variant: NotificationVariant.Success,
              title: t(
                successCount === 1
                  ? DialFileManagerI18nKeys.ItemCopiedSuccessfully
                  : DialFileManagerI18nKeys.ItemsCopiedSuccessfully,
              ),
              message: t(
                successCount === 1
                  ? DialFileManagerI18nKeys.ItemCopiedToFolder
                  : DialFileManagerI18nKeys.ItemsCopiedToFolder,
                {
                  count: successCount,
                  fileName: firstSuccessfulItem?.destinationName,
                  folder: formatOperationFolderName(
                    destinationFolder,
                    rootLabel,
                  ),
                },
              ),
            });
          }

          if (failedCount > 0 && failedCount < results.length) {
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(DialFileManagerI18nKeys.CopyPartialError, {
                count: failedCount,
              }),
            });
          } else if (failedCount === results.length) {
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(DialFileManagerI18nKeys.CopyError),
            });
          }
        } catch {
          if (!controller.signal.aborted) {
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(DialFileManagerI18nKeys.CopyError),
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
      t,
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
          results: Awaited<ReturnType<typeof renameFiles>>['results'];
          threw: boolean;
        }> => {
          if (renameDtos.length === 0) return { results: [], threw: false };
          try {
            const { results } = await renameFiles(renameDtos);
            return { results, threw: false };
          } catch {
            return { results: [], threw: true };
          }
        };

        const runMove = async (): Promise<{
          results: Awaited<ReturnType<typeof moveFiles>>['results'];
          threw: boolean;
          aborted: boolean;
        }> => {
          if (moveDtos.length === 0) {
            return { results: [], threw: false, aborted: false };
          }
          try {
            const { results } = await moveFiles(moveDtos, controller.signal);
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

          onNotification?.({
            variant: NotificationVariant.Success,
            title: t(
              moveSuccessCount === 1
                ? DialFileManagerI18nKeys.ItemMovedSuccessfully
                : DialFileManagerI18nKeys.ItemsMovedSuccessfully,
            ),
            message: t(
              moveSuccessCount === 1
                ? DialFileManagerI18nKeys.ItemMovedToFolder
                : DialFileManagerI18nKeys.ItemsMovedToFolder,
              {
                count: moveSuccessCount,
                fileName: firstSuccessfulItem?.destinationName,
                folder: formatOperationFolderName(destinationFolder, rootLabel),
              },
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
          notifyOperationSuccess(
            renamedDto.nodeType === RenameItemDtoNodeTypeEnum.Folder
              ? NotifiableEntity.Folder
              : NotifiableEntity.File,
            EntityOperation.Renamed,
            {
              name: getVirtualPathName(
                renamedDto.destinationPath,
                renamedDto.destinationPath,
              ),
            },
          );
        }

        if (totalFailed > 0) {
          if (totalFailed === totalCount) {
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(
                useMoveCopy
                  ? DialFileManagerI18nKeys.MoveError
                  : DialFileManagerI18nKeys.RenameError,
              ),
            });
          } else {
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(
                useMoveCopy
                  ? DialFileManagerI18nKeys.MovePartialError
                  : DialFileManagerI18nKeys.RenamePartialError,
                { count: totalFailed },
              ),
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
      notifyOperationSuccess,
      onNotification,
      t,
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
