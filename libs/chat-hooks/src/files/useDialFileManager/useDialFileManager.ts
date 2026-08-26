import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileManagerActions,
  DialFileManagerTabs,
  FileManagerColumnKey,
} from '@epam/ai-dial-react-file-manager';
import { useCallback, useMemo } from 'react';
import {
  hasDialFileWritePermission,
  isCopyMoveDuplicateAllowed,
  isShareActionsAllowed,
} from '../dial-file-manager-path.util';
import {
  COLUMNS_WITH_AUTHOR,
  COLUMNS_WITHOUT_AUTHOR,
  DATE_OPTIONS,
} from '../dial-file-manager.model';
import type {
  UseDialFileManagerOptions,
  UseDialFileManagerResult,
} from '../dial-file-manager.types';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
  deriveActionProfile,
} from '../file-manager-variant';
import { useDialFileListing } from '../useDialFileListing/useDialFileListing';
import { useDialFileMetadata } from '../useDialFileMetadata/useDialFileMetadata';
import { useDialFileMutations } from '../useDialFileMutations/useDialFileMutations';
import { useDialFileSharing } from '../useDialFileSharing/useDialFileSharing';
import { useDialFileUploadBatch } from '../useDialFileUploadBatch/useDialFileUploadBatch';

export type {
  UseDialFileManagerOptions,
  UseDialFileManagerResult,
} from '../dial-file-manager.types';

/**
 * Composes the five file-manager sub-hooks — listing/navigation, upload
 * batches, CRUD mutations, sharing, and metadata — into the single flat
 * result `DialFileManagerShell`/`DialFileManagerModal`/`DialFileManagerPage`
 * consume. Cache ownership and cross-hook invalidation stay inside
 * `useDialFileListing`; this composer only wires that hook's
 * `invalidateFolders`/`bumpRetry` into its siblings and derives the handful
 * of tab/actionProfile UI fields that read outputs from more than one
 * sub-hook. Imports neither `react-i18next` nor any application context —
 * every translated string reaches it through `labels`,
 * `disabledNewButtonTooltip`, and `buildValidationErrorMessage`.
 */
export const useDialFileManager = ({
  filesApi,
  bucket,
  rootLabel = 'My files',
  activeTab = DialFileManagerTabs.MyFiles,
  onNotification,
  onOperationSuccess,
  forbiddenSymbolsRegExp,
  variant = DialFileManagerVariant.Attach,
  actionProfile,
  labels,
  locale,
  disabledNewButtonTooltip,
  downloadDestination,
  buildValidationErrorMessage,
}: UseDialFileManagerOptions): UseDialFileManagerResult => {
  const resolvedActionProfile = actionProfile ?? deriveActionProfile(variant);

  const listing = useDialFileListing({
    filesApi,
    bucket,
    rootLabel,
    activeTab,
    onNotification,
  });

  const upload = useDialFileUploadBatch({
    filesApi,
    bucket,
    rootLabel,
    activeTab,
    cache: listing.cache,
    sharedRootMetaRef: listing.sharedRootMetaRef,
    invalidateFolders: listing.invalidateFolders,
    bumpRetry: listing.bumpRetry,
    onNotification,
  });

  const mutations = useDialFileMutations({
    filesApi,
    bucket,
    rootLabel,
    activeTab,
    folderPath: listing.folderPath,
    currentFolder: listing.currentFolder,
    sharedRootMetaRef: listing.sharedRootMetaRef,
    listingPermissionsCache: listing.listingPermissionsCache,
    invalidateFolders: listing.invalidateFolders,
    bumpRetry: listing.bumpRetry,
    mergeCreatedFolder: listing.mergeCreatedFolder,
    setFolderPath: listing.setFolderPath,
    onNotification,
    onOperationSuccess,
    downloadDestination,
    forbiddenSymbolsRegExp,
  });

  const sharing = useDialFileSharing({
    filesApi,
    bucket,
    rootLabel,
    bumpRetry: listing.bumpRetry,
    onNotification,
  });

  const metadata = useDialFileMetadata({
    filesApi,
    bucket,
    rootLabel,
    onNotification,
  });

  const canWriteCurrentFolder = hasDialFileWritePermission(
    listing.currentFolder,
  );

  const uploadEnabled = useMemo((): boolean => {
    if (activeTab === DialFileManagerTabs.Organization) return false;
    if (activeTab === DialFileManagerTabs.Shared && listing.folderPath === '') {
      return false;
    }
    return canWriteCurrentFolder;
  }, [activeTab, listing.folderPath, canWriteCurrentFolder]);

  const visibleColumns = useMemo(
    (): FileManagerColumnKey[] =>
      activeTab === DialFileManagerTabs.Shared
        ? COLUMNS_WITH_AUTHOR
        : COLUMNS_WITHOUT_AUTHOR,
    [activeTab],
  );

  const actionLabels = useMemo(() => {
    const result: Partial<Record<DialFileManagerActions, string>> = {};
    const setLabel = (action: DialFileManagerActions): void => {
      const label = labels[action];
      if (label != null) result[action] = label;
    };

    setLabel(DialFileManagerActions.Download);
    if (activeTab === DialFileManagerTabs.MyFiles) {
      setLabel(DialFileManagerActions.Delete);
      if (uploadEnabled) {
        setLabel(DialFileManagerActions.Rename);
        if (isCopyMoveDuplicateAllowed(resolvedActionProfile)) {
          setLabel(DialFileManagerActions.Copy);
          setLabel(DialFileManagerActions.Move);
          setLabel(DialFileManagerActions.Duplicate);
        }
      }
      if (isShareActionsAllowed(resolvedActionProfile)) {
        setLabel(DialFileManagerActions.RemoveAccess);
      }
    } else if (
      activeTab === DialFileManagerTabs.Shared &&
      isShareActionsAllowed(resolvedActionProfile)
    ) {
      setLabel(DialFileManagerActions.Unshare);
    }
    // Info is read-only and available on all three tabs — not tab-branched.
    if (resolvedActionProfile === DialFileManagerActionProfile.Full) {
      setLabel(DialFileManagerActions.Info);
    }
    return result;
  }, [activeTab, uploadEnabled, resolvedActionProfile, labels]);

  const isAnyOperationInProgress = useMemo(
    (): boolean =>
      mutations.isCreatingFolder ||
      mutations.isDownloading ||
      mutations.isDeleting ||
      mutations.isRenaming ||
      mutations.isCopying ||
      mutations.isMoving ||
      sharing.isUnsharing ||
      sharing.isRemovingAccess ||
      upload.uploadBatchState != null,
    [
      mutations.isCreatingFolder,
      mutations.isDownloading,
      mutations.isDeleting,
      mutations.isRenaming,
      mutations.isCopying,
      mutations.isMoving,
      sharing.isUnsharing,
      sharing.isRemovingAccess,
      upload.uploadBatchState,
    ],
  );

  const onCreateFolderValidate = useCallback(
    (name: string, parentFolder: DialFile): string | null => {
      const error = mutations.onCreateFolderValidate(name, parentFolder);
      return error ? buildValidationErrorMessage(error) : null;
    },
    [mutations, buildValidationErrorMessage],
  );

  const onRenameValidate = useCallback(
    (value: string, item: DialFile): string | null => {
      const error = mutations.onRenameValidate(value, item);
      return error ? buildValidationErrorMessage(error, item) : null;
    },
    [mutations, buildValidationErrorMessage],
  );

  return {
    items: listing.items,
    isLoading: listing.isLoading,
    error: listing.error,
    path: listing.path,
    onPathChange: listing.onPathChange,
    retry: listing.retry,
    onSearchFiles: listing.onSearchFiles,
    isSearching: listing.isSearching,
    searchResults: listing.searchResults,
    clearSearchResults: listing.clearSearchResults,
    expandedPaths: listing.expandedPaths,
    loadedPaths: listing.loadedPaths,
    onExpandedPathsChange: listing.onExpandedPathsChange,
    onFolderPopupPathChange: listing.onFolderPopupPathChange,
    folderPopupLoadingPaths: listing.folderPopupLoadingPaths,
    onUploadFiles: upload.onUploadFiles,
    onUploadArchive: upload.onUploadArchive,
    onValidateUpload: upload.onValidateUpload,
    uploadBatchState: upload.uploadBatchState,
    cancelUpload: upload.cancelUpload,
    clearUploadBatch: upload.clearUploadBatch,
    onCreateFolder: mutations.onCreateFolder,
    onCreateFolderValidate,
    isCreatingFolder: mutations.isCreatingFolder,
    onDownloadFiles: mutations.onDownloadFiles,
    isDownloading: mutations.isDownloading,
    onDeleteFiles: mutations.onDeleteFiles,
    isDeleting: mutations.isDeleting,
    onRenameValidate,
    onMoveToFiles: mutations.onMoveToFiles,
    isRenaming: mutations.isRenaming,
    onCopyFiles: mutations.onCopyFiles,
    isCopying: mutations.isCopying,
    isMoving: mutations.isMoving,
    cancelCopyMove: mutations.cancelCopyMove,
    uploadEnabled,
    isNewButtonDisabled: !uploadEnabled,
    disabledNewButtonTooltip,
    visibleColumns,
    dateLocale: locale,
    dateOptions: DATE_OPTIONS,
    actionLabels,
    sharedWithMeIds: listing.sharedWithMeIds,
    sharedByMePaths: listing.sharedByMePaths,
    onUnshareFiles: sharing.onUnshareFiles,
    isUnsharing: sharing.isUnsharing,
    onRemoveFilesAccess: sharing.onRemoveFilesAccess,
    isRemovingAccess: sharing.isRemovingAccess,
    fileMetadata: metadata.fileMetadata,
    isFileMetadataLoading: metadata.isFileMetadataLoading,
    onGetInfo: metadata.onGetInfo,
    clearMetadata: metadata.clearMetadata,
    isAnyOperationInProgress,
  };
};
