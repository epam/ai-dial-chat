import { useEffect } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { FilesUploadingModal } from './FilesUploadingModal';
import { OperationLoaderModal } from './OperationLoaderModal';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialFileManager, DialLoader } from '@epam/ai-dial-ui-kit';

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

    operationLoaderModal,
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
    handleCopyFiles,
    handleGetInfo,
    moveToFileHandler,
    handleDeleteFiles,
    handleDownloadFiles,
    handleTableFileClick,
    handleUploadFiles,
    handleCreateFolder,
    handleUploadArchive,
    handleUnshareFile,
  } = useFileManager();

  useEffect(() => {
    if (initialDataStatus === UploadStatus.LOADED) {
      dispatch(FilesActions.getFilesWithFolders({}));
    }
  }, [initialDataStatus, dispatch]);

  return (
    <div className="flex w-full grow overflow-auto">
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
        bulkActionsToolbarOptions={bulkActionsToolbarOptions}
        treeOptions={treeOptions}
        fileMetadataPopupOptions={fileMetadataPopupOptions}
        navigationPanelOptions={navigationPanelOptions}
        gridOptions={gridOptions}
        toolbarOptions={toolbarOptions}
        onCopyFiles={handleCopyFiles}
        onGetInfo={handleGetInfo}
        onMoveToFiles={moveToFileHandler}
        onDeleteFiles={handleDeleteFiles}
        onDownloadFiles={handleDownloadFiles}
        onTableFileClick={handleTableFileClick}
        destinationFolderPopupOptions={destinationFolderPopupOptions}
        deleteConfirmationOptions={deleteConfirmationOptions}
        onUploadFiles={handleUploadFiles}
        onCreateFolder={handleCreateFolder}
        onUploadArchive={handleUploadArchive}
        onUnshareFile={handleUnshareFile}
      />
      {isAnyOperationInProgress && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay">
          <DialLoader size={48} ariaLabel={t('Processing files...')} />
        </div>
      )}
      {operationLoaderModal && (
        <OperationLoaderModal
          title={operationLoaderModal.title}
          text={operationLoaderModal.text}
          onCancel={operationLoaderModal.onCancel}
        />
      )}
      {filesUploadingModalOptions && (
        <FilesUploadingModal
          title={filesUploadingModalOptions.title}
          text={filesUploadingModalOptions.text}
          files={filesUploadingModalOptions.files}
        />
      )}
    </div>
  );
};
