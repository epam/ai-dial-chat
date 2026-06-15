import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  UseFileManagerActionLabelsOptions,
  useFileManagerActionLabels,
} from '@/src/hooks/useFileManagerActionLabels';
import { useTranslation } from '@/src/hooks/useTranslation';

import { constructPath, prepareFileName } from '@/src/utils/app/file';
import {
  buildFileTree,
  convertToUIKitFile,
  convertToUIKitFolder,
  filterFilesByFilters,
  filterFoldersByFilters,
} from '@/src/utils/app/file-manager-adapter';
import { dispatchOpenFileManagerUnshareDialog } from '@/src/utils/app/file-manager-unshare-dispatch';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getFileRootId, getRootId, isRootId } from '@/src/utils/app/id';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
  defaultMyItemsFilters,
} from '@/src/utils/app/search';
import { hasWritePermission } from '@/src/utils/app/share';
import { getEntityBucket } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';

import { DialFile as LocalDialFileType } from '@/src/types/files';
import type { RootState } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import { PublicationActions, ShareActions } from '@/src/store/actions';
import { FilesActions } from '@/src/store/files/files.reducers';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import {
  MY_FILES_SECTION,
  ORGANIZATION_FILES_SECTION,
  REVIEW_FILES_SECTION,
  SHARED_WITH_ME_FILES_SECTION,
} from '@/src/constants/fileManager';
import { SideBarI18nKeys } from '@/src/constants/i18n';
import { getEntityNameSchema } from '@/src/constants/validation-helpers';

import {
  GridOptions,
  NavigationPanelOptions,
  ToolbarOptions,
} from '@epam/ai-dial-ui-kit/dist/src/components/FileManager/FileManager';

import { FilesUploadingModalOptions } from '../FilesUploadingModal';
import {
  UseGridEditingScrollOptions,
  useGridEditingScroll,
} from './useGridEditingScroll';

import {
  FeatureType,
  FolderInterface,
  UploadStatus,
} from '@epam/ai-dial-shared';
import {
  ButtonVariant,
  DialCopiedItem,
  DialDeletedItem,
  DialFile,
  DialFileManagerTabs,
  DialFileNodeType,
  DialUploadFileItem,
  FileManagerColumnKey,
  GridSelectionMode,
  useDialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';
import cloneDeep from 'lodash-es/cloneDeep';
import uniqBy from 'lodash-es/uniqBy';

const formatSharedPath = (
  path: string | undefined | null,
  sharedWithMeLabel: string,
) => {
  if (!path) return path;
  return path.replace(/^files\/[^/]+/, sharedWithMeLabel);
};

function extractHiddenSharedPathPart(
  rootFolderPath: string,
  rootItemPath: string,
  rootItemName: string,
): string | null {
  if (!rootItemPath.startsWith(rootFolderPath)) {
    return null;
  }

  const afterRoot = rootItemPath
    .slice(rootFolderPath.length)
    .replace(/^\/+/, '');

  if (!afterRoot.endsWith(rootItemName)) {
    return null;
  }

  const hidden = afterRoot.slice(0, afterRoot.length - rootItemName.length);

  return hidden.replace(/\/$/, '') || null;
}

const newActions = {
  uploadFiles: {
    label: translate(SideBarI18nKeys.UploadFiles, {
      ns: Translation.SideBar,
    }),
  },
  newFolder: {
    label: translate(SideBarI18nKeys.NewFolder, { ns: Translation.SideBar }),
  },
  uploadArchive: {
    label: translate(SideBarI18nKeys.UploadArchive, {
      ns: Translation.SideBar,
    }),
  },
};

const dateOptions = {
  year: 'numeric' as const,
  month: 'short' as const,
  day: '2-digit' as const,
};

const getInitialTab = (availableTabs?: Set<string>) => {
  if (!availableTabs?.size) return DialFileManagerTabs.MyFiles;

  const tabPriority = [
    DialFileManagerTabs.MyFiles,
    DialFileManagerTabs.Organization,
    DialFileManagerTabs.Shared,
    DialFileManagerTabs.Review,
  ] as const;

  return (
    tabPriority.find((tab) => availableTabs.has(tab)) ??
    DialFileManagerTabs.MyFiles
  );
};

const defaultAvailableTabs = new Set([
  DialFileManagerTabs.MyFiles,
  DialFileManagerTabs.Shared,
  DialFileManagerTabs.Organization,
]);

interface UseFileManagerOptions {
  actionLabelsOptions?: UseFileManagerActionLabelsOptions;
  toolbarOptions?: ToolbarOptions;
  availableTabs?: Set<string>;
  reviewBucket?: string;
  initialTab?: DialFileManagerTabs;
  additionalFilesAndFolders?: {
    files: LocalDialFileType[];
    folders?: FolderInterface[];
  };
  gridEditingOptions?: UseGridEditingScrollOptions;
}

export const useFileManager = ({
  actionLabelsOptions,
  toolbarOptions: externalToolbarOptions,
  availableTabs = defaultAvailableTabs,
  reviewBucket,
  initialTab,
  additionalFilesAndFolders,
  gridEditingOptions: gridEditingOptionsConfig,
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
  const isDeletingFiles = useAppSelector(FilesSelectors.selectIsDeletingFiles);
  const movingFilesCountRef = useRef<number>(0);
  const prevIsCopyingRef = useRef(false);
  const prevIsMovingRef = useRef(false);
  const prevIsDeletingRef = useRef(false);

  const fileMetadata = useAppSelector(FilesSelectors.selectFileMetadata);
  const _files = useAppSelector(FilesSelectors.selectFiles);
  const _folders = useAppSelector(FilesSelectors.selectFolders);

  const files = useMemo(
    () =>
      uniqBy([..._files, ...(additionalFilesAndFolders?.files ?? [])], 'id'),
    [_files, additionalFilesAndFolders?.files],
  );
  const folders = useMemo(
    () =>
      uniqBy(
        [..._folders, ...(additionalFilesAndFolders?.folders ?? [])],
        'id',
      ),
    [_folders, additionalFilesAndFolders?.folders],
  );

  const sharedWithMeIds = useAppSelector(
    FilesSelectors.selectSharedWithMeFilesAndFoldersIds,
  );

  const isUploadingFiles = useAppSelector(
    FilesSelectors.selectIsUploadingFiles,
  );

  const isRenamingRef = useRef(false);

  const {
    freezeItems,
    additionalGridOptions: gridEditingOptions,
    reset: resetGridEditing,
  } = useGridEditingScroll(gridEditingOptionsConfig);

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

    const title = t(SideBarI18nKeys.UploadingItems);
    const text = t(SideBarI18nKeys.ItemsUploaded, {
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
  const [isSearching, setIsSearching] = useState(false);
  const [destinationPath, setDestinationPath] = useState<string | undefined>();

  const currentFolder = useMemo(() => {
    return currentPath ? folders.find((f) => f.id === currentPath) : undefined;
  }, [currentPath, folders]);

  const canWriteCurrentFolder = hasWritePermission(currentFolder?.permissions);

  const [treeCollapsedState, setTreeCollapsedState] = useState<
    boolean | undefined
  >(false);

  const safeInitialTab =
    initialTab && availableTabs?.size && !availableTabs.has(initialTab)
      ? undefined
      : initialTab;

  const fallbackInitialTab =
    availableTabs?.size && !availableTabs.has(DialFileManagerTabs.MyFiles)
      ? getInitialTab(availableTabs)
      : undefined;
  const resolvedInitialTab = safeInitialTab ?? fallbackInitialTab;

  const { activeTab, handleTabChange, tabs } = useDialFileManagerTabs(
    {
      my_files: t(MY_FILES_SECTION),
      shared: t(SHARED_WITH_ME_FILES_SECTION),
      organization: t(ORGANIZATION_FILES_SECTION),
      review: t(REVIEW_FILES_SECTION),
    },
    resolvedInitialTab,
  );
  const handleTabChangeWithRefresh = useCallback(
    (tab: DialFileManagerTabs) => {
      handleTabChange(tab);
      if (tab === DialFileManagerTabs.MyFiles) {
        dispatch(
          FilesActions.getFilesWithFolders({ skipShareListingsRefresh: true }),
        );
      }

      if (tab === DialFileManagerTabs.Shared) {
        dispatch(ShareActions.triggerGettingSharedFilesListings());
      }

      if (tab === DialFileManagerTabs.Organization) {
        dispatch(
          PublicationActions.uploadPublishedWithMeItems({
            featureType: FeatureType.File,
          }),
        );
      }
    },
    [handleTabChange, dispatch],
  );

  const previousActiveTabRef = useRef<DialFileManagerTabs | null>(null);

  const searchSelector = useCallback(
    (state: RootState) =>
      currentPath && isSearching && !isLoadingSearchListing
        ? FilesSelectors.selectSearchResultsForFolder(
            state,
            activeTab === DialFileManagerTabs.Shared && isRootId(currentPath)
              ? undefined
              : currentPath,
            activeTab === DialFileManagerTabs.Shared,
          )
        : { files: [], folders: [] },
    [currentPath, isSearching, isLoadingSearchListing, activeTab],
  );

  const searchResults = useAppSelector(searchSelector);

  const searchResultsUIKit = useMemo(
    () => [
      ...searchResults.folders.map((f) => {
        const uiFolder = convertToUIKitFolder(f, []);
        if (activeTab === DialFileManagerTabs.Shared) {
          uiFolder.parentPath = formatSharedPath(
            uiFolder.parentPath,
            t(SHARED_WITH_ME_FILES_SECTION),
          );
          uiFolder.folderId = formatSharedPath(
            uiFolder.folderId,
            t(SHARED_WITH_ME_FILES_SECTION),
          ) as string;
        }
        return uiFolder;
      }),
      ...searchResults.files.map((f) => {
        const uiFile = convertToUIKitFile(f);
        if (activeTab === DialFileManagerTabs.Shared) {
          uiFile.parentPath = formatSharedPath(
            uiFile.parentPath,
            t(SHARED_WITH_ME_FILES_SECTION),
          );
          uiFile.folderId = formatSharedPath(
            uiFile.folderId,
            t(SHARED_WITH_ME_FILES_SECTION),
          ) as string;
        }
        return uiFile;
      }),
    ],
    [searchResults, activeTab, t],
  );

  const filteredTabs = useMemo(() => {
    if (!availableTabs || !availableTabs.size) {
      return tabs;
    }
    return tabs?.filter((tab) => availableTabs.has(tab.id));
  }, [availableTabs, tabs]);

  useEffect(() => {
    const copyJustFinished = prevIsCopyingRef.current && !isCopyingFiles;
    const moveJustFinished = prevIsMovingRef.current && !isMovingFiles;
    prevIsCopyingRef.current = isCopyingFiles;
    prevIsMovingRef.current = isMovingFiles;

    if ((copyJustFinished || moveJustFinished) && isSearching && currentPath) {
      dispatch(FilesActions.getFullListing({ folderPath: currentPath }));
    }
  }, [isCopyingFiles, isMovingFiles, isSearching, currentPath, dispatch]);

  useEffect(() => {
    const deleteJustFinished = prevIsDeletingRef.current && !isDeletingFiles;
    prevIsDeletingRef.current = isDeletingFiles;

    if (deleteJustFinished) {
      deduplicatedFileIdsRef.current.clear();
    }
  }, [isDeletingFiles]);

  useEffect(() => {
    if (currentPath && !isRootId(currentPath) && !isMovingFiles) {
      const folder = folders.find((folder) => folder.id === currentPath);
      if (!folder) {
        const parentId = getFolderIdFromEntityId(currentPath);
        setCurrentPath(parentId);
      } else if (
        folder?.status !== UploadStatus.LOADED &&
        folder?.status !== UploadStatus.LOADING
      ) {
        dispatch(FilesActions.getFilesWithFolders({ id: currentPath }));
      }
    }
  }, [dispatch, currentPath, folders, isMovingFiles]);

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
    uploadEnabled,
  } = useMemo(() => {
    let filteredFiles = files;
    let filteredFolders = folders;
    let pathRootAlias = t(MY_FILES_SECTION);
    let uploadEnabled = true;
    const visibleColumns: FileManagerColumnKey[] = [
      FileManagerColumnKey.Name,
      FileManagerColumnKey.UpdatedAt,
      FileManagerColumnKey.Size,
      FileManagerColumnKey.Actions,
    ];

    switch (activeTab) {
      case DialFileManagerTabs.MyFiles:
        filteredFiles = filterFilesByFilters(
          files,
          defaultMyItemsFilters,
          getFileRootId(),
        );
        filteredFolders = filterFoldersByFilters(
          folders,
          defaultMyItemsFilters,
        );
        pathRootAlias = t(MY_FILES_SECTION);
        break;
      case DialFileManagerTabs.Shared:
        filteredFiles = filterFilesByFilters(files, SharedWithMeFilters);
        filteredFolders = filterFoldersByFilters(folders, SharedWithMeFilters);
        pathRootAlias = t(SHARED_WITH_ME_FILES_SECTION);
        visibleColumns.push(FileManagerColumnKey.Author);
        break;
      case DialFileManagerTabs.Organization:
        filteredFiles = filterFilesByFilters(files, PublishedWithMeFilter);
        filteredFolders = filterFoldersByFilters(
          folders,
          PublishedWithMeFilter,
        );
        pathRootAlias = t(ORGANIZATION_FILES_SECTION);
        uploadEnabled = false;
        break;
      case DialFileManagerTabs.Review:
        filteredFiles = files.filter(
          (f) => getEntityBucket(f) === reviewBucket,
        );
        filteredFolders = folders.filter(
          (f) => getEntityBucket(f) === reviewBucket,
        );
        pathRootAlias = t(REVIEW_FILES_SECTION);
        uploadEnabled = false;
        break;
      default:
        break;
    }

    const firstEntityId =
      filteredFolders?.[0]?.id || filteredFiles?.[0]?.id || '';
    const rootId = firstEntityId
      ? getFileRootId(getEntityBucket({ id: firstEntityId }))
      : getFileRootId();

    const { rootFolder, items, loadedFoldersPaths, sharedByMePaths } =
      buildFileTree(filteredFiles, filteredFolders, pathRootAlias, rootId);

    if (activeTab === DialFileManagerTabs.Shared) {
      const currentSharedRootId =
        isRootId(currentPath) && currentPath
          ? currentPath
          : getRootId({
              featureType: FeatureType.File,
              id: currentPath,
            });

      rootFolder.id = currentSharedRootId;
      rootFolder.path = currentSharedRootId;
      uploadEnabled = isRootId(currentPath) && currentPath ? false : true;
    }

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
      uploadEnabled,
    };
  }, [files, folders, activeTab, reviewBucket, currentPath, t]);

  const stableFileTreeItems = freezeItems(fileTreeItems);

  const getDestinationFolderCopyHeader = useCallback(
    (count: number, name: string | undefined) => {
      return count === 1 && name
        ? t(SideBarI18nKeys.CopyNameTo, { name })
        : t(SideBarI18nKeys.CopyItemsTo, { count });
    },
    [t],
  );

  const getDestinationFolderMoveHeader = useCallback(
    (count: number, name: string | undefined) => {
      return count === 1 && name
        ? t(SideBarI18nKeys.MoveNameTo, { name })
        : t(SideBarI18nKeys.MoveItemsTo, { count });
    },
    [t],
  );

  const { bulkActionLabels, treeActionLabels, gridActionLabels } =
    useFileManagerActionLabels(activeTab, t, actionLabelsOptions);

  const renderDeleteConfirmationTitle = useCallback(
    (files: string[]) => {
      const count = files.length;
      return count === 1
        ? t(SideBarI18nKeys.ConfirmDeletingItem)
        : t(SideBarI18nKeys.ConfirmDeletingItems);
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
                {t(SideBarI18nKeys.AreYouSureDeleteItem)}{' '}
                <span className="break-all text-primary">
                  “{files[0].split('/').pop()}”?
                </span>
              </>
            ) : (
              <>
                {t(SideBarI18nKeys.DoYouWantToDeleteFollowing)}{' '}
                <span className="text-primary">
                  {files.length} {t(SideBarI18nKeys.ItemsQuestion)}
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

      const movedCurrentOrParent = movedItems.find(
        (item) =>
          item.sourceUrl === currentPath ||
          currentPath?.startsWith(item.sourceUrl),
      );

      if (movedCurrentOrParent) {
        setCurrentPath(movedCurrentOrParent.destinationUrl);
      }
    },
    [dispatch, currentPath],
  );

  const handleSearchFiles = useCallback(
    (folder: string) => {
      setIsSearching(true);
      if (folder !== currentPath) {
        setCurrentPath(folder);
      }

      if (activeTab === DialFileManagerTabs.Shared && isRootId(folder)) {
        const sharedSet = new Set(sharedWithMeIds);
        dispatch(
          FilesActions.getFullListing({
            folderPath: folder,
            paths: folders.filter((f) => sharedSet.has(f.id)).map((f) => f.id),
          }),
        );
      } else {
        dispatch(FilesActions.getFullListing({ folderPath: folder }));
      }
    },
    [dispatch, currentPath, activeTab, folders, sharedWithMeIds],
  );

  const handleClearSearch = useCallback(() => {
    setIsSearching(false);
  }, []);

  const operationLoaderModalOptions = useMemo(() => {
    if (!isCopyingFiles && !isMovingFiles) {
      return null;
    }

    const cancelHandler = isCopyingFiles
      ? () => dispatch(FilesActions.cancelCopyingFiles())
      : () => dispatch(FilesActions.cancelMovingFiles());

    return {
      title: t(
        isCopyingFiles
          ? SideBarI18nKeys.CopyingFiles
          : SideBarI18nKeys.MovingItems,
      ),
      text: t(SideBarI18nKeys.ItemsBeingAction, {
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
          ? t(SideBarI18nKeys.ItemSelected, { count: selectedCount })
          : t(SideBarI18nKeys.ItemsSelected, { count: selectedCount });
      },
    }),
    [bulkActionLabels, t],
  );

  const treeOptions = useMemo(
    () => ({
      expandedPaths,
      header: t(SideBarI18nKeys.FolderTree),
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
      title: t(SideBarI18nKeys.InformationSidebar),
      nameLabel: t(SideBarI18nKeys.NameLabel),
      pathLabel: t(SideBarI18nKeys.PathLabel),
      modifiedDateLabel: t(SideBarI18nKeys.ModifiedLabel),
      sizeLabel: t(SideBarI18nKeys.SizeLabel),
      authorLabel: t(SideBarI18nKeys.AuthorLabel),
      loading: isFileMetadataLoading,
      fileMetadata: adjustedMetadata ?? undefined,
    };
  }, [t, isFileMetadataLoading, fileMetadata, currentPathRootAlias]);

  const navigationPanelOptions = useMemo<NavigationPanelOptions>(() => {
    const options: NavigationPanelOptions = {
      searchable: true,
    };

    if (
      activeTab === DialFileManagerTabs.Shared &&
      currentPath &&
      currentPath !== rootFolder.path &&
      rootFolder.items?.length
    ) {
      const rootItem = rootFolder.items.find(
        (item) =>
          currentPath === item.path || currentPath.startsWith(item.path + '/'),
      );

      if (rootItem) {
        const breadcrumbsHiddenPathPart = extractHiddenSharedPathPart(
          rootFolder.path,
          rootItem.path,
          rootItem.name,
        );

        options.breadcrumbsHiddenPathPart =
          breadcrumbsHiddenPathPart ?? undefined;
      }
    }

    return options;
  }, [currentPath, rootFolder, activeTab]);

  const gridOptions: GridOptions = useMemo(
    () => ({
      filterable: false,
      dateLocale: 'en-US',
      dateOptions: dateOptions,
      actionLabels: gridActionLabels,
      visibleColumns: visibleColumns,
      selectionMode: GridSelectionMode.MULTIPLE,
      additionalGridOptions: gridEditingOptions,
    }),
    [gridActionLabels, visibleColumns, gridEditingOptions],
  );

  const toolbarOptions = useMemo<ToolbarOptions>(
    () => ({
      tabs: filteredTabs,
      activeTab: activeTab,
      onTabChange: handleTabChangeWithRefresh,
      newButtonVariant: ButtonVariant.Primary,
      newActions,
      showHiddenFilesToggle: true,
      isNewButtonDisabled:
        activeTab === DialFileManagerTabs.Organization ||
        (activeTab === DialFileManagerTabs.Shared && !canWriteCurrentFolder),
      disabledNewButtonTooltip: t(SideBarI18nKeys.NoPermissionToCreateItems),
      ...externalToolbarOptions,
    }),
    [
      filteredTabs,
      activeTab,
      handleTabChangeWithRefresh,
      canWriteCurrentFolder,
      t,
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

      const deletedCurrentOrParent = deletedItems.find(
        (item) =>
          item.sourceUrl === currentPath ||
          currentPath?.startsWith(item.sourceUrl),
      );

      if (deletedCurrentOrParent) {
        const parentId = getFolderIdFromEntityId(
          deletedCurrentOrParent.sourceUrl,
        );

        setCurrentPath(parentId);
      }
    },
    [dispatch, currentPath],
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

      const existingInFolder = new Set(
        files.filter((f) => f.folderId === destinationUrl).map((f) => f.name),
      );

      const namesInCurrentBatch = new Set<string>();

      const processedFiles = filesToUpload.map((file) => {
        const sanitizedName = prepareFileName(file.name);
        let finalName = sanitizedName;

        const isNameModified = sanitizedName !== file.name;
        const conflictsWithBatch = namesInCurrentBatch.has(finalName);
        const conflictsWithFolder = existingInFolder.has(finalName);

        if (conflictsWithBatch || (isNameModified && conflictsWithFolder)) {
          let counter = 1;
          const extensionIndex = sanitizedName.lastIndexOf('.');
          const baseName =
            extensionIndex === -1
              ? sanitizedName
              : sanitizedName.substring(0, extensionIndex);
          const extension =
            extensionIndex === -1
              ? ''
              : sanitizedName.substring(extensionIndex);

          while (
            existingInFolder.has(finalName) ||
            namesInCurrentBatch.has(finalName)
          ) {
            finalName = `${baseName} (${counter})${extension}`;
            counter++;
          }
        }

        namesInCurrentBatch.add(finalName);

        return {
          ...file,
          name: finalName,
        };
      });

      dispatch(
        FilesActions.uploadFiles({
          files: processedFiles,
          destinationUrl,
        }),
      );

      setUploadingFilesIds(
        new Set(processedFiles.map((f) => getFileId(f.name, destinationUrl))),
      );
    },
    [dispatch, getFileId, files],
  );

  const deduplicatedFileIdsRef = useRef<Set<string>>(new Set());

  const handleCreateFolder = useCallback(
    (file: DialUploadFileItem, folderPath: string, fileId: string) => {
      if (deduplicatedFileIdsRef.current.has(fileId)) return;
      deduplicatedFileIdsRef.current.add(fileId);

      dispatch(
        FilesActions.createNewFolder({
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
          name: prepareFileName(name),
          destinationUrl,
        }),
      );
    },
    [dispatch],
  );

  const handleOpenUnshareFilesDialog = useCallback(
    (items: { path: string; nodeType?: string }[]) => {
      dispatchOpenFileManagerUnshareDialog(
        dispatch,

        items,
        'unshare-files',
      );
    },
    [dispatch],
  );

  const handleOpenRemoveFilesAccessDialog = useCallback(
    (items: { path: string; nodeType?: string }[]) => {
      dispatchOpenFileManagerUnshareDialog(
        dispatch,

        items,
        'remove-access',
      );
    },
    [dispatch],
  );

  const handleRenameValidation = useCallback(
    (value: string, item: DialFile) => {
      const schema = getEntityNameSchema({
        name:
          item.nodeType === DialFileNodeType.FOLDER
            ? t(SideBarI18nKeys.FolderNameLabel)
            : t(SideBarI18nKeys.FileNameLabel),
        checkDotsInTheEnd: true,
        checkDotsInTheStart: true,
      });

      const validationResult = schema.safeParse(value);

      if (validationResult.success) {
        return null;
      } else {
        return validationResult.error.issues[0].message;
      }
    },
    [t],
  );

  const emptyStateTitle = useMemo(() => {
    switch (activeTab) {
      case DialFileManagerTabs.Shared:
        return t(SideBarI18nKeys.NoSharedFiles);
      case DialFileManagerTabs.Organization:
        return t(SideBarI18nKeys.NoOrganizationFiles);
      default:
        return t(SideBarI18nKeys.YouDontHaveAnyFiles);
    }
  }, [activeTab, t]);

  const emptyStateDescription = useMemo(() => {
    switch (activeTab) {
      case DialFileManagerTabs.Shared:
        return t(SideBarI18nKeys.SharedFilesWillAppear);
      case DialFileManagerTabs.Organization:
        return t(SideBarI18nKeys.PublicFilesWillAppear);
      default:
        return t(SideBarI18nKeys.UploadOrDragDropFiles);
    }
  }, [activeTab, t]);

  return {
    currentPath,
    setCurrentPath,
    areFilesLoading,
    areFoldersLoading,
    isAnyOperationInProgress,
    fileTreeItems: stableFileTreeItems,
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
    resetGridEditing,

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
  };
};
