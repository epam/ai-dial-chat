import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import {
  buildFileTree,
  filterFilesByFilters,
  filterFoldersByFilters,
} from '@/src/utils/app/file-manager-adapter';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
  defaultMyItemsFilters,
} from '@/src/utils/app/search';

import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { DialFileManager, useDialFileManagerTabs } from '@epam/ai-dial-ui-kit';

export const FileManager: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string | undefined>();
  const [destinationPath, setDestinationPath] = useState<string | undefined>();
  const [treeCollapsedState, setTreeCollapsedState] = useState<
    boolean | undefined
  >(true);
  const [loadedFolderIds, setLoadedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();

  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const initialized = useAppSelector(FilesSelectors.selectInitialized);
  const areFilesLoading = useAppSelector(FilesSelectors.selectAreFilesLoading);
  const areFoldersLoading = useAppSelector(
    FilesSelectors.selectAreFoldersLoading,
  );

  const { activeTab, handleTabChange, tabs } = useDialFileManagerTabs({
    my_files: t('My Files'),
    shared: t('Shared with Me'),
    organization: t('Organization'),
  });

  const bucketRootId = useMemo(() => {
    const bucket = BucketService.getBucket();
    return bucket ? `files/${bucket}` : 'files';
  }, []);

  useEffect(() => {
    if (!initialized) {
      dispatch(FilesActions.init());
      setCurrentPath(bucketRootId);
    }
    dispatch(FilesActions.getFilesWithFolders({}));
    if (!loadedFolderIds.has(bucketRootId)) {
      dispatch(FilesActions.getFilesWithFolders({ id: bucketRootId }));
      setLoadedFolderIds((prev) => new Set(prev).add(bucketRootId));
    }
  }, [dispatch, initialized, bucketRootId, loadedFolderIds]);

  useEffect(() => {
    if (currentPath && currentPath !== bucketRootId) {
      if (!loadedFolderIds.has(currentPath)) {
        dispatch(FilesActions.getFilesWithFolders({ id: currentPath }));
        setLoadedFolderIds((prev) => new Set(prev).add(currentPath));
      }
    }
  }, [dispatch, currentPath, bucketRootId, loadedFolderIds, destinationPath]);

  useEffect(() => {
    if (
      destinationPath &&
      destinationPath !== bucketRootId &&
      destinationPath !== currentPath
    ) {
      if (!loadedFolderIds.has(destinationPath)) {
        dispatch(FilesActions.getFilesWithFolders({ id: destinationPath }));
        setLoadedFolderIds((prev) => new Set(prev).add(destinationPath));
      }
    }
  }, [dispatch, currentPath, bucketRootId, loadedFolderIds, destinationPath]);

  const { fileTreeItems, rootFolder } = useMemo(() => {
    let filteredFiles = files;
    let filteredFolders = folders;
    let breadcrumbLabel = t('My Files');

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

    const { rootFolder, items } = buildFileTree(
      filteredFiles,
      filteredFolders,
      bucketRootId,
      breadcrumbLabel,
    );

    return { rootFolder, fileTreeItems: items };
  }, [files, folders, bucketRootId, activeTab, t]);

  const getParentPaths = (path: string | undefined): string[] => {
    if (!path) return [];
    const parts = path.split('/');
    const paths: string[] = [];
    for (let i = 1; i <= parts.length; i++) {
      paths.push(parts.slice(0, i).join('/'));
    }
    return paths;
  };

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(getParentPaths(bucketRootId)),
  );

  useEffect(() => {
    setExpandedPaths((prev) => {
      const newPaths = getParentPaths(currentPath || bucketRootId);
      const updated = new Set(prev);
      newPaths.forEach((p) => updated.add(p));
      return updated;
    });
  }, [currentPath, bucketRootId]);

  return (
    <DialFileManager
      path={currentPath || bucketRootId}
      onPathChange={setCurrentPath}
      items={fileTreeItems}
      rootItem={rootFolder}
      filesLoading={areFilesLoading || areFoldersLoading}
      bulkActionsToolbarOptions={{
        selectionLabel: t('files selected'),
        actionLabels: {
          duplicate: t('Duplicate'),
          copy: t('Copy to'),
          move: t('Move to'),
          delete: t('Delete'),
          download: t('Download'),
        },
      }}
      treeOptions={{
        expandedPaths,
        collapsed: treeCollapsedState,
        onCollapseChange: setTreeCollapsedState,
        actionLabels: {
          duplicate: t('Duplicate'),
          copy: t('Copy to'),
          move: t('Move to'),
          delete: t('Delete'),
          download: t('Download'),
          rename: t('Rename'),
        },
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
        actionLabels: {
          duplicate: t('Duplicate'),
          copy: t('Copy to'),
          move: t('Move to'),
          delete: t('Delete'),
          download: t('Download'),
        },
      }}
      toolbarOptions={{
        tabs: tabs,
        activeTab: activeTab,
        onTabChange: handleTabChange,
      }}
      onCopyFiles={(copiedItems, destinationFolder) => {
        if (copiedItems.length === 0) return;
        dispatch(
          FilesActions.copyFiles({ files: copiedItems, destinationFolder }),
        );
      }}
      onMoveToFiles={(movedItems, sourceFolder, destinationFolder) => {
        if (movedItems.length === 0) return;
        dispatch(
          FilesActions.moveFiles({
            files: movedItems,
            sourceFolder,
            destinationFolder,
          }),
        );
      }}
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
            files: filesToDownload as DialFile[],
          }),
        );
      }}
      onTableFileClick={(row) => {
        void row;
      }}
      destinationFolderPopupOptions={{
        destinationFolderPath: destinationPath,
        setDestinationFolderPath: setDestinationPath,
      }}
    />
  );
};
