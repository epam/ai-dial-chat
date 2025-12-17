import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFileManagerActionLabels } from '@/src/hooks/useFileManagerActionLabels';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  buildFileTree,
  convertToUIKitFile,
  filterFilesByFilters,
  filterFoldersByFilters,
} from '@/src/utils/app/file-manager-adapter';
import { getFileRootId, isRootId } from '@/src/utils/app/id';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
  defaultMyItemsFilters,
} from '@/src/utils/app/search';

import { Translation } from '@/src/types/translation';

import { ShareActions } from '@/src/store/actions';
import { FilesActions } from '@/src/store/files/files.reducers';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { OperationLoaderModal } from './OperationLoaderModal';

import { FeatureType, UploadStatus } from '@epam/ai-dial-shared';
import {
  ButtonVariant,
  DialCopiedItem,
  DialFileManager,
  DialLoader,
  FileManagerColumnKey,
  useDialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';

export const FileManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.SideBar);

  const isFileMetadataLoading = useAppSelector(
    FilesSelectors.selectLoadingFileMetadata,
  );
  const areFilesLoading = useAppSelector(FilesSelectors.selectAreFilesLoading);
  const areFoldersLoading = useAppSelector(
    FilesSelectors.selectAreFoldersLoading,
  );
  const initialDataStatus = useAppSelector(
    SettingsSelectors.selectInitialDataStatus,
  );
  const isAnyOperationInProgress = useAppSelector(
    FilesSelectors.selectIsAnyFileOperationInProgress,
  );

  const isCopyingFiles = useAppSelector(FilesSelectors.selectIsCopyingFiles);
  const isMovingFiles = useAppSelector(FilesSelectors.selectIsMovingFiles);
  const movingFilesCountRef = useRef<number>(0);

  const fileMetadata = useAppSelector(FilesSelectors.selectFileMetadata);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);

  const isLoadingSearchListing = useAppSelector(
    FilesSelectors.selectIsLoadingSearchListing,
  );

  const [currentPath, setCurrentPath] = useState<string | undefined>();
  const [destinationPath, setDestinationPath] = useState<string | undefined>();

  const searchResults = useAppSelector(
    useCallback(
      (state) =>
        currentPath
          ? FilesSelectors.selectSearchResultsForFolder(state, currentPath)
          : [],
      [currentPath],
    ),
  );

  const searchResultsUIKit = useMemo(
    () => searchResults.map(convertToUIKitFile),
    [searchResults],
  );

  const [treeCollapsedState, setTreeCollapsedState] = useState<
    boolean | undefined
  >(true);

  const { activeTab, handleTabChange, tabs } = useDialFileManagerTabs({
    my_files: t('My Files'),
    shared: t('Shared with Me'),
    organization: t('Organization'),
  });
  const previousActiveTabRef = useRef(activeTab);

  useEffect(() => {
    if (initialDataStatus === UploadStatus.LOADED) {
      dispatch(FilesActions.getFilesWithFolders({}));
    }
  }, [initialDataStatus, dispatch]);

  useEffect(() => {
    if (currentPath && !isRootId(currentPath)) {
      const folder = folders.find((folder) => folder.id === currentPath);
      if (folder?.status !== UploadStatus.LOADED) {
        dispatch(FilesActions.getFilesWithFolders({ id: currentPath }));
      }
    }
  }, [dispatch, currentPath, folders]);

  useEffect(() => {
    if (
      destinationPath &&
      destinationPath !== currentPath &&
      !isRootId(destinationPath)
    ) {
      const folder = folders.find((folder) => folder.id === destinationPath);
      if (folder?.status !== UploadStatus.LOADED) {
        dispatch(FilesActions.getFilesWithFolders({ id: destinationPath }));
      }
    }
  }, [dispatch, currentPath, destinationPath, folders]);

  const {
    fileTreeItems,
    rootFolder,
    loadedFoldersPaths,
    sharedByMePaths,
    visibleColumns,
  } = useMemo(() => {
    let filteredFiles = files;
    let filteredFolders = folders;
    let breadcrumbLabel = t('My Files');
    const visibleColumns: FileManagerColumnKey[] = [
      FileManagerColumnKey.Name,
      FileManagerColumnKey.UpdatedAt,
      FileManagerColumnKey.Size,
      FileManagerColumnKey.Actions,
    ];

    switch (activeTab) {
      case 'my_files':
        filteredFiles = filterFilesByFilters(files, defaultMyItemsFilters);
        filteredFolders = filterFoldersByFilters(
          folders,
          defaultMyItemsFilters,
        );
        breadcrumbLabel = t('My Files');
        break;
      case 'shared':
        filteredFiles = filterFilesByFilters(files, SharedWithMeFilters);
        filteredFolders = filterFoldersByFilters(folders, SharedWithMeFilters);
        breadcrumbLabel = t('Shared with Me');
        visibleColumns.push(FileManagerColumnKey.Author);
        break;
      case 'organization':
        filteredFiles = filterFilesByFilters(files, PublishedWithMeFilter);
        filteredFolders = filterFoldersByFilters(
          folders,
          PublishedWithMeFilter,
        );
        breadcrumbLabel = t('Organization');
        break;
      default:
        break;
    }

    const { rootFolder, items, loadedFoldersPaths, sharedByMePaths } =
      buildFileTree(filteredFiles, filteredFolders, breadcrumbLabel);

    if (activeTab !== previousActiveTabRef.current) {
      setCurrentPath(rootFolder.id);
      previousActiveTabRef.current = activeTab;
    }

    return {
      rootFolder,
      fileTreeItems: items,
      loadedFoldersPaths,
      sharedByMePaths,
      visibleColumns,
    };
  }, [t, files, folders, activeTab, previousActiveTabRef]);

  const getParentPaths = (path: string | undefined): string[] => {
    if (!path) return [];
    const parts = path.split('/');
    const paths: string[] = [];
    for (let i = 1; i <= parts.length; i++) {
      paths.push(parts.slice(0, i).join('/'));
    }
    return paths;
  };

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    return new Set(getParentPaths(getFileRootId()));
  });

  useEffect(() => {
    setExpandedPaths((prev) => {
      const newPaths = getParentPaths(currentPath);
      const updated = new Set(prev);
      newPaths.forEach((p) => updated.add(p));
      return updated;
    });
  }, [currentPath]);

  const getDestinationFolderCopyHeader = useCallback(
    (count: number, name: string | undefined) => {
      return count === 1 && name
        ? t('Copy "{{name}}" to', { name })
        : t('Copy {{count}} items to', { count });
    },
    [t],
  );

  const getDestinationFolderMoveHeader = useCallback(
    (count: number, name: string | undefined) => {
      return count === 1 && name
        ? t('Move "{{name}}" to', { name })
        : t('Move {{count}} items to', { count });
    },
    [t],
  );

  const { bulkActionLabels, treeActionLabels, gridActionLabels } =
    useFileManagerActionLabels(activeTab, t);

  const renderDeleteConfirmationTitle = useCallback(
    (files: string[]) => {
      const count = files.length;
      return count === 1
        ? t('Confirm Deleting Item')
        : t('Confirm Deleting Items');
    },
    [t],
  );

  const renderDeleteConfirmationContent = useCallback(
    (files: string[]) => {
      return (
        <div className="px-6 py-3 text-sm">
          <p className="mb-3 text-secondary">
            {files.length === 1 ? (
              <>
                {t('Are you sure you want to delete')}{' '}
                <span className="break-all text-primary">
                  “{files[0].split('/').pop()}”?
                </span>
              </>
            ) : (
              <>
                {t('Do you want to delete the following')}{' '}
                <span className="text-primary">
                  {files.length} {t('items?')}
                </span>
              </>
            )}
          </p>
        </div>
      );
    },
    [t],
  );

  const moveToFileHandler = useCallback(
    (
      movedItems: DialCopiedItem[],
      sourceFolder: string,
      destinationFolder: string,
    ) => {
      if (movedItems.length === 0) return;

      movingFilesCountRef.current = movedItems.length;

      dispatch(
        FilesActions.moveFiles({
          files: movedItems,
          sourceFolder,
          destinationFolder,
        }),
      );

      const movedCurrent = movedItems.find(
        (item) => item.sourceUrl === currentPath,
      );

      if (movedCurrent) {
        setCurrentPath(undefined);
      }
    },
    [dispatch, currentPath],
  );

  const handleSearchFiles = useCallback(
    (folder: string) => {
      dispatch(FilesActions.getFullListing({ folderPath: folder }));
    },
    [dispatch],
  );

  const renderOperationLoaderModal = () => {
    if (!isCopyingFiles && !isMovingFiles) {
      return null;
    }

    const cancelHandler = isCopyingFiles
      ? () => dispatch(FilesActions.cancelCopyingFiles())
      : () => dispatch(FilesActions.cancelMovingFiles());

    return (
      <OperationLoaderModal
        title={t(isCopyingFiles ? 'Copying files' : 'Moving items')}
        text={t('{{count}} items are being {{action}}…', {
          count: movingFilesCountRef.current,
          action: isCopyingFiles ? 'copied' : 'moved',
        })}
        onCancel={cancelHandler}
      />
    );
  };

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
        bulkActionsToolbarOptions={{
          actionLabels: bulkActionLabels,
          getSelectionLabel(selectedCount) {
            return selectedCount === 1
              ? t('{{count}} item selected', { count: selectedCount })
              : t('{{count}} items selected', { count: selectedCount });
          },
        }}
        treeOptions={{
          expandedPaths,
          title: t('Folder tree'),
          collapsed: treeCollapsedState,
          onCollapseChange: setTreeCollapsedState,
          loadedPaths: loadedFoldersPaths,
          actionLabels: treeActionLabels,
        }}
        fileMetadataPopupOptions={{
          title: t('Information'),
          nameLabel: t('Name: '),
          pathLabel: t('Path: '),
          modifiedDateLabel: t('Modified: '),
          sizeLabel: t('Size: '),
          authorLabel: t('Author: '),
          loading: isFileMetadataLoading,
          fileMetadata: fileMetadata ?? undefined,
        }}
        navigationPanelOptions={{
          searchable: true,
        }}
        gridOptions={{
          filterable: false,
          dateLocale: 'en-US',
          dateOptions: {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
          },
          actionLabels: gridActionLabels,
          visibleColumns: visibleColumns,
        }}
        toolbarOptions={{
          tabs: tabs,
          activeTab: activeTab,
          onTabChange: handleTabChange,
          newButtonVariant: ButtonVariant.Primary,
          newActionLabels: {
            uploadFiles: t('Upload files'),
            newFolder: t('New folder'),
            uploadArchive: t('Upload archive'),
          },
        }}
        onCopyFiles={(copiedItems, destinationFolder) => {
          if (copiedItems.length === 0) return;
          movingFilesCountRef.current = copiedItems.length;
          dispatch(
            FilesActions.copyFiles({ files: copiedItems, destinationFolder }),
          );
        }}
        onGetInfo={(item) => {
          if (!item) return;
          dispatch(FilesActions.getFileMetadata({ fileId: item.path }));
        }}
        onMoveToFiles={moveToFileHandler}
        onDeleteFiles={(deletedItems, folderUrl) => {
          if (deletedItems.length === 0) return;
          dispatch(
            FilesActions.deleteFiles({
              files: deletedItems,
              folderUrl,
            }),
          );
        }}
        onDownloadFiles={(filesToDownload) => {
          if (filesToDownload.length === 0) return;
          dispatch(
            FilesActions.downloadFilesAsArchive({
              files: filesToDownload,
            }),
          );
        }}
        onTableFileClick={(row) => {
          void row;
        }}
        destinationFolderPopupOptions={{
          destinationFolderPath: destinationPath,
          setDestinationFolderPath: setDestinationPath,
          getCopyHeader: getDestinationFolderCopyHeader,
          getMoveHeader: getDestinationFolderMoveHeader,
        }}
        deleteConfirmationOptions={{
          titleRenderer: renderDeleteConfirmationTitle,
          contentRenderer: renderDeleteConfirmationContent,
        }}
        onUploadFiles={(filesToUpload, destinationUrl) => {
          if (filesToUpload.length === 0) return;
          dispatch(
            FilesActions.uploadFiles({
              files: filesToUpload,
              destinationUrl,
            }),
          );
        }}
        onCreateFolder={(file, folderPath) => {
          dispatch(
            FilesActions.uploadFiles({
              files: [file],
              destinationUrl: folderPath,
            }),
          );
        }}
        onUploadArchive={(archiveFile, name, destinationUrl) => {
          if (!archiveFile) return;
          dispatch(
            FilesActions.uploadArchive({
              archive: archiveFile,
              name,
              destinationUrl,
            }),
          );
        }}
        onUnshareFile={(file) => {
          dispatch(
            ShareActions.discardSharedWithMe({
              resourceIds: [file.path],
              featureType: FeatureType.File,
              isFolder: file.nodeType === 'folder',
            }),
          );
        }}
      />
      {isAnyOperationInProgress && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay">
          <DialLoader size={48} ariaLabel={t('Processing files...')} />
        </div>
      )}
      {renderOperationLoaderModal()}
    </div>
  );
};
