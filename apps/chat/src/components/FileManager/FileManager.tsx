import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFileManagerActionLabels } from '@/src/hooks/useFileManagerActionLabels';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  buildFileTree,
  filterFilesByFilters,
  filterFoldersByFilters,
} from '@/src/utils/app/file-manager-adapter';
import { getEntityBucket, getFileRootId } from '@/src/utils/app/id';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
  defaultMyItemsFilters,
} from '@/src/utils/app/search';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';
import {
  ButtonVariant,
  DialCopiedItem,
  DialFileManager,
  DialLoader,
  FileManagerColumnKey,
  useDialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';

export const FileManager: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string | undefined>();
  const [destinationPath, setDestinationPath] = useState<string | undefined>();
  const [treeCollapsedState, setTreeCollapsedState] = useState<
    boolean | undefined
  >(true);
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();

  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const initialized = useAppSelector(FilesSelectors.selectInitialized);
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

  const { activeTab, handleTabChange, tabs } = useDialFileManagerTabs({
    my_files: t('My Files'),
    shared: t('Shared with Me'),
    organization: t('Organization'),
  });
  const previousActiveTabRef = useRef(activeTab);

  const bucketRootId = useMemo(
    () => getFileRootId(getEntityBucket({ id: currentPath ?? '' })),
    [currentPath],
  );

  useEffect(() => {
    if (!initialized) {
      dispatch(FilesActions.init());
    }
  }, [dispatch, initialized]);

  useEffect(() => {
    if (initialized && initialDataStatus === UploadStatus.LOADED) {
      setCurrentPath(bucketRootId);
      dispatch(FilesActions.getFilesWithFolders({ id: bucketRootId }));
    }
  }, [dispatch, initialized, initialDataStatus, bucketRootId]);

  useEffect(() => {
    if (currentPath && currentPath !== bucketRootId) {
      const folder = folders.find((folder) => folder.id === currentPath);
      if (folder?.status !== UploadStatus.LOADED) {
        dispatch(FilesActions.getFilesWithFolders({ id: currentPath }));
      }
    }
  }, [dispatch, currentPath, bucketRootId, folders]);

  useEffect(() => {
    if (
      destinationPath &&
      destinationPath !== bucketRootId &&
      destinationPath !== currentPath
    ) {
      const folder = folders.find((folder) => folder.id === destinationPath);
      if (folder?.status !== UploadStatus.LOADED) {
        dispatch(FilesActions.getFilesWithFolders({ id: destinationPath }));
      }
    }
  }, [dispatch, currentPath, bucketRootId, destinationPath, folders]);

  const { fileTreeItems, rootFolder, loadedFoldersPaths, visibleColumns } =
    useMemo(() => {
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
          filteredFolders = filterFoldersByFilters(
            folders,
            SharedWithMeFilters,
          );
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

      const { rootFolder, items, loadedFoldersPaths } = buildFileTree(
        filteredFiles,
        filteredFolders,
        breadcrumbLabel,
      );

      if (
        bucketRootId !== rootFolder.id ||
        activeTab !== previousActiveTabRef.current
      ) {
        setCurrentPath(rootFolder.id);
        previousActiveTabRef.current = activeTab;
      }

      return {
        rootFolder,
        fileTreeItems: items,
        loadedFoldersPaths,
        visibleColumns,
      };
    }, [t, files, folders, activeTab, previousActiveTabRef, bucketRootId]);

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
      const newPaths = getParentPaths(currentPath || bucketRootId);
      const updated = new Set(prev);
      newPaths.forEach((p) => updated.add(p));
      return updated;
    });
  }, [currentPath, bucketRootId]);

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

  const moveToFileHandler = useCallback(
    (
      movedItems: DialCopiedItem[],
      sourceFolder: string,
      destinationFolder: string,
    ) => {
      if (movedItems.length === 0) return;

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

  return (
    <div className="relative size-full">
      <DialFileManager
        path={currentPath || bucketRootId}
        onPathChange={setCurrentPath}
        items={fileTreeItems}
        rootItem={rootFolder}
        filesLoading={areFilesLoading || areFoldersLoading}
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
          collapsed: treeCollapsedState,
          onCollapseChange: setTreeCollapsedState,
          loadedPaths: loadedFoldersPaths,
          actionLabels: treeActionLabels,
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
          dispatch(
            FilesActions.copyFiles({ files: copiedItems, destinationFolder }),
          );
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
      />
      {isAnyOperationInProgress && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay">
          <DialLoader size={48} ariaLabel={t('Processing files...')} />
        </div>
      )}
    </div>
  );
};
