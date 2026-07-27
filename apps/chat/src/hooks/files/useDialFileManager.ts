import {
  DialFileManagerActions,
  DialFileManagerTabs,
  FileManagerColumnKey,
} from '@epam/ai-dial-ui-kit';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
} from '../../constants/translation-keys';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
  deriveActionProfile,
} from '../../types/file-manager-variant';
import {
  hasDialFileWritePermission,
  isCopyMoveDuplicateAllowed,
  isShareActionsAllowed,
} from './dial-file-manager-path.util';
import {
  COLUMNS_WITH_AUTHOR,
  COLUMNS_WITHOUT_AUTHOR,
  DATE_OPTIONS,
} from './dial-file-manager.model';
import type {
  UseDialFileManagerOptions,
  UseDialFileManagerResult,
} from './dial-file-manager.types';
import { useDialFileListing } from './useDialFileListing';
import { useDialFileMetadata } from './useDialFileMetadata';
import { useDialFileMutations } from './useDialFileMutations';
import { useDialFileSharing } from './useDialFileSharing';
import { useDialFileUploadBatch } from './useDialFileUploadBatch';

export type {
  UseDialFileManagerOptions,
  UseDialFileManagerResult,
} from './dial-file-manager.types';

/**
 * Composes the five file-manager sub-hooks — listing/navigation, upload
 * batches, CRUD mutations, sharing, and metadata — into the single flat
 * result `DialFileManagerShell`/`DialFileManagerModal`/`DialFileManagerPage`
 * consume. Cache ownership and cross-hook invalidation stay inside
 * `useDialFileListing` (design.md D1); this composer only wires that hook's
 * `invalidateFolders`/`bumpRetry` into its siblings and derives the handful
 * of tab/actionProfile UI fields that read outputs from more than one
 * sub-hook (design.md D5).
 */
export const useDialFileManager = ({
  bucket,
  rootLabel = 'My files',
  activeTab = DialFileManagerTabs.MyFiles,
  onNotification,
  forbiddenSymbolsRegExp,
  variant = DialFileManagerVariant.Attach,
  actionProfile = deriveActionProfile(variant),
}: UseDialFileManagerOptions): UseDialFileManagerResult => {
  const { t, i18n } = useTranslation();

  const listing = useDialFileListing({
    bucket,
    rootLabel,
    activeTab,
    onNotification,
  });

  const upload = useDialFileUploadBatch({
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
    forbiddenSymbolsRegExp,
  });

  const sharing = useDialFileSharing({
    bucket,
    rootLabel,
    bumpRetry: listing.bumpRetry,
    onNotification,
  });

  const metadata = useDialFileMetadata({
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
    const labels: Partial<Record<DialFileManagerActions, string>> = {
      [DialFileManagerActions.Download]: t(ButtonsI18nKeys.Download),
    };
    if (activeTab === DialFileManagerTabs.MyFiles) {
      labels[DialFileManagerActions.Delete] = t(ButtonsI18nKeys.Delete);
      if (uploadEnabled) {
        labels[DialFileManagerActions.Rename] = t(ButtonsI18nKeys.Rename);
        if (isCopyMoveDuplicateAllowed(actionProfile)) {
          labels[DialFileManagerActions.Copy] = t(ButtonsI18nKeys.Copy);
          labels[DialFileManagerActions.Move] = t(
            DialFileManagerI18nKeys.MoveAction,
          );
          labels[DialFileManagerActions.Duplicate] = t(
            ButtonsI18nKeys.Duplicate,
          );
        }
      }
      if (isShareActionsAllowed(actionProfile)) {
        labels[DialFileManagerActions.RemoveAccess] = t(
          DialFileManagerI18nKeys.RemoveAccessAction,
        );
      }
    } else if (
      activeTab === DialFileManagerTabs.Shared &&
      isShareActionsAllowed(actionProfile)
    ) {
      labels[DialFileManagerActions.Unshare] = t(
        DialFileManagerI18nKeys.UnshareAction,
      );
    }
    // Info is read-only and available on all three tabs — not tab-branched.
    if (actionProfile === DialFileManagerActionProfile.Full) {
      labels[DialFileManagerActions.Info] = t(
        DialFileManagerI18nKeys.InfoAction,
      );
    }
    return labels;
  }, [activeTab, uploadEnabled, actionProfile, t]);

  const disabledNewButtonTooltip = t('dialFileManager.noPermissionToCreate');

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
    onCreateFolderValidate: mutations.onCreateFolderValidate,
    isCreatingFolder: mutations.isCreatingFolder,
    onDownloadFiles: mutations.onDownloadFiles,
    isDownloading: mutations.isDownloading,
    onDeleteFiles: mutations.onDeleteFiles,
    isDeleting: mutations.isDeleting,
    onRenameValidate: mutations.onRenameValidate,
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
    dateLocale: i18n.language,
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
