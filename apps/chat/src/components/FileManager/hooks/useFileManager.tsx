import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  UseFileManagerActionLabelsOptions,
  useFileManagerActionLabels,
} from '@/src/hooks/useFileManagerActionLabels';
import { useTranslation } from '@/src/hooks/useTranslation';

import { constructPath } from '@/src/utils/app/file';
import {
  buildFileTree,
  convertToUIKitFile,
  filterFilesByFilters,
  filterFoldersByFilters,
} from '@/src/utils/app/file-manager-adapter';
import { getFileRootId, getRootId, isRootId } from '@/src/utils/app/id';
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

import { ToolbarOptions } from '@epam/ai-dial-ui-kit/dist/src/components/FileManager/FileManager';

import { FilesUploadingModalOptions } from '../FilesUploadingModal';

import { FeatureType, UploadStatus } from '@epam/ai-dial-shared';
import {
  ButtonVariant,
  DialCopiedItem,
  DialDeletedItem,
  DialFile,
  DialFileManagerTabs,
  DialUploadFileItem,
  FileManagerColumnKey,
  useDialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';
import cloneDeep from 'lodash-es/cloneDeep';
import groupBy from 'lodash-es/groupBy';

interface UseFileManagerOptions {
  actionLabelsOptions?: UseFileManagerActionLabelsOptions;
  toolbarOptions?: ToolbarOptions;
  availableTabs?: Set<string>;
}

export const useFileManager = ({
  actionLabelsOptions,
  toolbarOptions: externalToolbarOptions,
  availableTabs,
}: UseFileManagerOptions = {}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.SideBar);

  const isFileMetadataLoading = useAppSelector(
    FilesSelectors.selectLoadingFileMetadata,
  );
  const areFilesLoading = useAppSelector(FilesSelectors.selectAreFilesLoading);
  const areFoldersLoading = useAppSelector(
    FilesSelectors.selectAreFoldersLoading,
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

  const isUploadingFiles = useAppSelector(
    FilesSelectors.selectIsUploadingFiles,
  );

  const isRenamingRef = useRef(false);

  const [uploadingFilesIds, setUploadingFilesIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!isUploadingFiles && uploadingFilesIds.size) {
      setUploadingFilesIds(new Set());
    }
  }, [isUploadingFiles, uploadingFilesIds]);

  const uploadingFiles = useMemo(() => {
    return files.filter((file) => uploadingFilesIds.has(file.id));
  }, [files, uploadingFilesIds]);

  const filesUploadingModalOptions = useMemo(() => {
    if (!isUploadingFiles || !uploadingFiles?.length) return null;

    const files = uploadingFiles.map(({ id, name, status, percent }) => ({
      id,
      name,
      status,
      percent,
    }));

    const title = t('Uploading items');
    const text = t('{{done}} of {{total}} items uploaded...', {
      done: files.filter((f) => f.status !== UploadStatus.LOADING).length,
      total: files.length,
    });

    const onCancel = () =>
      dispatch(FilesActions.cancelUploadFiles(uploadingFilesIds));

    return { title, text, files, onCancel } as FilesUploadingModalOptions;
  }, [isUploadingFiles, uploadingFiles, uploadingFilesIds, t, dispatch]);

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
  const previousActiveTabRef = useRef<DialFileManagerTabs | null>(null);

  const filteredTabs = useMemo(() => {
    if (!availableTabs || !availableTabs.size) {
      return tabs;
    }
    return tabs?.filter((tab) => availableTabs.has(tab.id));
  }, [availableTabs, tabs]);

  useEffect(() => {
    if (currentPath && !isRootId(currentPath)) {
      const folder = folders.find((folder) => folder.id === currentPath);
      if (folder?.status !== UploadStatus.LOADED) {
        dispatch(FilesActions.getFilesWithFolders({ id: currentPath }));
      }
    }
  }, [dispatch, currentPath, folders]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const getParentPaths = useCallback((path: string | undefined): string[] => {
    if (!path) return [];
    const parts = path.split('/');
    const paths: string[] = [];
    for (let i = 2; i <= parts.length; i++) {
      paths.push(parts.slice(0, i).join('/'));
    }
    return paths;
  }, []);

  useEffect(() => {
    setExpandedPaths((prev) => {
      const newPaths = getParentPaths(currentPath);
      const updated = new Set(prev);
      newPaths.forEach((p) => updated.add(p));

      return updated;
    });
  }, [currentPath, getParentPaths]);

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
    currentPathRootAlias,
  } = useMemo(() => {
    let filteredFiles = files;
    let filteredFolders = folders;
    let pathRootAlias = t('My Files');
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
        pathRootAlias = t('My Files');
        break;
      case 'shared':
        filteredFiles = filterFilesByFilters(files, SharedWithMeFilters);
        filteredFolders = filterFoldersByFilters(folders, SharedWithMeFilters);
        pathRootAlias = t('Shared with Me');
        visibleColumns.push(FileManagerColumnKey.Author);
        break;
      case 'organization':
        filteredFiles = filterFilesByFilters(files, PublishedWithMeFilter);
        filteredFolders = filterFoldersByFilters(
          folders,
          PublishedWithMeFilter,
        );
        pathRootAlias = t('Organization');
        break;
      default:
        break;
    }

    const { rootFolder, items, loadedFoldersPaths, sharedByMePaths } =
      buildFileTree(filteredFiles, filteredFolders, pathRootAlias);

    if (
      activeTab !== previousActiveTabRef.current &&
      rootFolder.id &&
      isRootId(rootFolder.id)
    ) {
      setCurrentPath(rootFolder.id);
      setExpandedPaths(new Set([rootFolder.id]));
      previousActiveTabRef.current = activeTab;
    }

    return {
      rootFolder,
      fileTreeItems: items,
      loadedFoldersPaths,
      sharedByMePaths,
      visibleColumns,
      currentPathRootAlias: pathRootAlias,
    };
  }, [t, files, folders, activeTab, previousActiveTabRef]);

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
    useFileManagerActionLabels(activeTab, t, actionLabelsOptions);

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

  const handleMoveFiles = useCallback(
    (
      movedItems: DialCopiedItem[],
      sourceFolder: string,
      destinationFolder: string,
    ) => {
      if (movedItems.length === 0) return;

      movingFilesCountRef.current = movedItems.length;
      isRenamingRef.current = sourceFolder === destinationFolder;

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

  const operationLoaderModalOptions = useMemo(() => {
    if (!isCopyingFiles && !isMovingFiles) {
      return null;
    }

    const cancelHandler = isCopyingFiles
      ? () => dispatch(FilesActions.cancelCopyingFiles())
      : () => dispatch(FilesActions.cancelMovingFiles());

    return {
      title: t(isCopyingFiles ? 'Copying files' : 'Moving items'),
      text: t('{{count}} items are being {{action}}…', {
        count: movingFilesCountRef.current,
        action: isCopyingFiles ? 'copied' : 'moved',
      }),
      onCancel: cancelHandler,
    };
  }, [isCopyingFiles, isMovingFiles, dispatch, t]);

  const bulkActionsToolbarOptions = useMemo(
    () => ({
      actionLabels: bulkActionLabels,
      getSelectionLabel(selectedCount: number) {
        return selectedCount === 1
          ? t('{{count}} item selected', { count: selectedCount })
          : t('{{count}} items selected', { count: selectedCount });
      },
    }),
    [bulkActionLabels, t],
  );

  const treeOptions = useMemo(
    () => ({
      expandedPaths,
      header: t('Folder tree'),
      collapsed: treeCollapsedState,
      onCollapseChange: setTreeCollapsedState,
      loadedPaths: loadedFoldersPaths,
      actionLabels: treeActionLabels,
      onExpandedPathsChange: setExpandedPaths,
    }),
    [
      expandedPaths,
      setExpandedPaths,
      t,
      treeCollapsedState,
      loadedFoldersPaths,
      treeActionLabels,
    ],
  );

  const fileMetadataPopupOptions = useMemo(() => {
    const adjustedMetadata = cloneDeep(fileMetadata);

    if (adjustedMetadata?.path && currentPathRootAlias) {
      const root = getRootId({
        featureType: FeatureType.File,
        id: adjustedMetadata.path,
      });
      adjustedMetadata.path = adjustedMetadata.path.replace(
        root,
        currentPathRootAlias,
      );
    }

    return {
      title: t('Information'),
      nameLabel: t('Name: '),
      pathLabel: t('Path: '),
      modifiedDateLabel: t('Modified: '),
      sizeLabel: t('Size: '),
      authorLabel: t('Author: '),
      loading: isFileMetadataLoading,
      fileMetadata: adjustedMetadata ?? undefined,
    };
  }, [t, isFileMetadataLoading, fileMetadata, currentPathRootAlias]);

  const navigationPanelOptions = useMemo(
    () => ({
      searchable: true,
    }),
    [],
  );

  const dateOptions = useMemo(
    () => ({
      year: 'numeric' as const,
      month: 'short' as const,
      day: '2-digit' as const,
    }),
    [],
  );

  const gridOptions = useMemo(
    () => ({
      filterable: false,
      dateLocale: 'en-US',
      dateOptions: dateOptions,
      actionLabels: gridActionLabels,
      visibleColumns: visibleColumns,
    }),
    [dateOptions, gridActionLabels, visibleColumns],
  );

  const newActionLabels = useMemo(
    () => ({
      uploadFiles: t('Upload files'),
      newFolder: t('New folder'),
      uploadArchive: t('Upload archive'),
    }),
    [t],
  );

  const toolbarOptions = useMemo(
    () => ({
      tabs: filteredTabs,
      activeTab: activeTab,
      onTabChange: handleTabChange,
      newButtonVariant: ButtonVariant.Primary,
      newActionLabels: newActionLabels,
      ...externalToolbarOptions,
    }),
    [
      filteredTabs,
      activeTab,
      handleTabChange,
      newActionLabels,
      externalToolbarOptions,
    ],
  );

  const destinationFolderPopupOptions = useMemo(
    () => ({
      destinationFolderPath: destinationPath,
      setDestinationFolderPath: setDestinationPath,
      getCopyHeader: getDestinationFolderCopyHeader,
      getMoveHeader: getDestinationFolderMoveHeader,
    }),
    [
      destinationPath,
      getDestinationFolderCopyHeader,
      getDestinationFolderMoveHeader,
    ],
  );

  const deleteConfirmationOptions = useMemo(
    () => ({
      titleRenderer: renderDeleteConfirmationTitle,
      contentRenderer: renderDeleteConfirmationContent,
    }),
    [renderDeleteConfirmationTitle, renderDeleteConfirmationContent],
  );

  const handleCopyFiles = useCallback(
    (copiedItems: DialCopiedItem[], destinationFolder: string) => {
      if (copiedItems.length === 0) return;
      movingFilesCountRef.current = copiedItems.length;
      dispatch(
        FilesActions.copyFiles({ files: copiedItems, destinationFolder }),
      );
    },
    [dispatch],
  );

  const handleGetInfo = useCallback(
    (item: { path: string } | null) => {
      if (!item) return;
      dispatch(FilesActions.getFileMetadata({ fileId: item.path }));
    },
    [dispatch],
  );

  const handleDeleteFiles = useCallback(
    (deletedItems: DialDeletedItem[], folderUrl: string) => {
      if (deletedItems.length === 0) return;
      dispatch(
        FilesActions.deleteFiles({
          files: deletedItems,
          folderUrl,
        }),
      );
    },
    [dispatch],
  );

  const handleDownloadFiles = useCallback(
    (filesToDownload: DialFile[]) => {
      if (filesToDownload.length === 0) return;
      dispatch(
        FilesActions.downloadFilesAsArchive({
          files: filesToDownload,
        }),
      );
    },
    [dispatch],
  );

  const handleTableFileClick = useCallback((row: unknown) => {
    void row;
  }, []);

  const getFileId = useCallback((name: string, path: string) => {
    const urlParts = path.split('/');
    const bucket = urlParts.length > 1 ? urlParts[1] : undefined;
    const relativePath =
      urlParts.length > 2 ? urlParts.slice(2).join('/') : undefined;

    return constructPath(getFileRootId(bucket), relativePath, name);
  }, []);

  const handleUploadFiles = useCallback(
    (filesToUpload: DialUploadFileItem[], destinationUrl: string) => {
      if (filesToUpload.length === 0) return;
      dispatch(
        FilesActions.uploadFiles({
          files: filesToUpload,
          destinationUrl,
        }),
      );

      setUploadingFilesIds(
        new Set(filesToUpload.map((f) => getFileId(f.name, destinationUrl))),
      );
    },
    [dispatch, setUploadingFilesIds, getFileId],
  );

  const handleCreateFolder = useCallback(
    (file: DialUploadFileItem, folderPath: string) => {
      dispatch(
        FilesActions.uploadFiles({
          files: [file],
          destinationUrl: folderPath,
        }),
      );
    },
    [dispatch],
  );

  const handleUploadArchive = useCallback(
    (archiveFile: File | null, name: string, destinationUrl: string) => {
      if (!archiveFile) return;
      dispatch(
        FilesActions.uploadArchive({
          archive: archiveFile,
          name,
          destinationUrl,
        }),
      );
    },
    [dispatch],
  );

  const handleUnshareFiles = useCallback(
    (items: { path: string; nodeType?: string }[]) => {
      const grouped = groupBy(items, (item) =>
        item.nodeType === 'folder' ? 'folders' : 'files',
      );

      if (grouped.folders?.length) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: grouped.folders.map((f) => f.path),
            featureType: FeatureType.File,
            isFolder: true,
          }),
        );
      }

      if (grouped.files?.length) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: grouped.files.map((f) => f.path),
            featureType: FeatureType.File,
            isFolder: false,
          }),
        );
      }
    },
    [dispatch],
  );

  return {
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
    isRenaming: isRenamingRef.current,

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
    handleCopyFiles,
    handleGetInfo,
    handleMoveFiles,
    handleDeleteFiles,
    handleDownloadFiles,
    handleTableFileClick,
    handleUploadFiles,
    handleCreateFolder,
    handleUploadArchive,
    handleUnshareFiles,
  };
};
