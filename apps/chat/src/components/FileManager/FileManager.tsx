import React, { useEffect, useMemo, useState } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { SideBarI18nKeys } from '@/src/constants/i18n';

import { FilesUploadingModal } from './FilesUploadingModal';
import { OperationLoaderModal } from './OperationLoaderModal';

import { UploadStatus } from '@epam/ai-dial-shared';
import {
  DialFileManager,
  DialFileManagerActions,
  DialFileManagerTabs,
  DialLoader,
} from '@epam/ai-dial-ui-kit';

const availableTabs = new Set([
  DialFileManagerTabs.MyFiles,
  DialFileManagerTabs.Organization,
  DialFileManagerTabs.Shared,
]);

export const FileManager: React.FC = () => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const initialDataStatus = useAppSelector(
    SettingsSelectors.selectInitialDataStatus,
  );

  const {
    currentPath,
    setCurrentPath,
    areFilesLoading,
    areFoldersLoading,
    isAnyOperationInProgress,
    fileTreeItems,
    rootFolder,
    sharedByMePaths,
    isLoadingSearchListing,
    searchResultsUIKit,
    isRenaming,

    operationLoaderModalOptions,
    filesUploadingModalOptions,

    bulkActionsToolbarOptions,
    treeOptions,
    fileMetadataPopupOptions,
    navigationPanelOptions,
    gridOptions,
    toolbarOptions,
    destinationFolderPopupOptions,
    deleteConfirmationOptions,

    handleSearchFiles,
    handleClearSearch,
    handleCopyFiles,
    handleGetInfo,
    handleMoveFiles,
    handleDeleteFiles,
    handleDownloadFiles,
    handleTableFileClick,
    handleUploadFiles,
    handleCreateFolder,
    handleUploadArchive,
    handleOpenUnshareFilesDialog,
    handleOpenRemoveFilesAccessDialog,
    handleRenameValidation,

    sharedWithMeIds,

    uploadEnabled,

    emptyStateDescription,
    emptyStateTitle,
  } = useFileManager({
    availableTabs,
  });

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const allSelectedItemsShared = useMemo(() => {
    if (selectedPaths.size === 0) return false;
    for (const path of selectedPaths) {
      if (!sharedByMePaths?.has(path)) {
        return false;
      }
    }
    return true;
  }, [selectedPaths, sharedByMePaths]);

  const customBulkActionsToolbarOptions = useMemo(() => {
    if (!bulkActionsToolbarOptions) return bulkActionsToolbarOptions;

    if (allSelectedItemsShared) {
      return bulkActionsToolbarOptions;
    }

    const { [DialFileManagerActions.RemoveAccess]: __, ...restLabels } =
      bulkActionsToolbarOptions.actionLabels || {};

    return {
      ...bulkActionsToolbarOptions,
      actionLabels: restLabels,
    };
  }, [bulkActionsToolbarOptions, allSelectedItemsShared]);

  useEffect(() => {
    if (initialDataStatus === UploadStatus.LOADED) {
      dispatch(FilesActions.getFilesWithFolders({}));
    }
  }, [initialDataStatus, dispatch]);

  return (
    <div className="flex w-full grow overflow-auto" data-qa="file-manager">
      {initialDataStatus !== UploadStatus.LOADED ? (
        <DialLoader size={45} />
      ) : (
        <DialFileManager
          path={currentPath}
          onPathChange={setCurrentPath}
          items={fileTreeItems}
          rootItem={rootFolder}
          filesLoading={areFilesLoading || areFoldersLoading}
          sharedByMePaths={sharedByMePaths}
          onSearchFiles={handleSearchFiles}
          searchInProgress={isLoadingSearchListing}
          searchResults={searchResultsUIKit}
          onSelectedPathsChange={setSelectedPaths}
          bulkActionsToolbarOptions={customBulkActionsToolbarOptions}
          treeOptions={treeOptions}
          fileMetadataPopupOptions={fileMetadataPopupOptions}
          navigationPanelOptions={navigationPanelOptions}
          gridOptions={gridOptions}
          toolbarOptions={toolbarOptions}
          onCopyFiles={handleCopyFiles}
          onGetInfo={handleGetInfo}
          onMoveToFiles={handleMoveFiles}
          onDeleteFiles={handleDeleteFiles}
          onDownloadFiles={handleDownloadFiles}
          onTableFileClick={handleTableFileClick}
          destinationFolderPopupOptions={destinationFolderPopupOptions}
          deleteConfirmationOptions={deleteConfirmationOptions}
          onUploadFiles={handleUploadFiles}
          onCreateFolder={handleCreateFolder}
          onUploadArchive={handleUploadArchive}
          onUnshareFiles={handleOpenUnshareFilesDialog}
          onRemoveFilesAccess={handleOpenRemoveFilesAccessDialog}
          onRenameValidate={handleRenameValidation}
          onCreateFolderValidate={handleRenameValidation}
          sharedWithMeIds={sharedWithMeIds}
          uploadEnabled={uploadEnabled}
          clearSearchResults={handleClearSearch}
          emptyStateTitle={emptyStateTitle}
          emptyStateDescription={emptyStateDescription}
          hideSearchPathItemName
        />
      )}
      {isAnyOperationInProgress && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay">
          <DialLoader
            size={48}
            ariaLabel={t(SideBarI18nKeys.ProcessingFiles)}
          />
        </div>
      )}
      {operationLoaderModalOptions && !isRenaming && (
        <OperationLoaderModal {...operationLoaderModalOptions} />
      )}
      {filesUploadingModalOptions && (
        <FilesUploadingModal {...filesUploadingModalOptions} />
      )}
    </div>
  );
};
