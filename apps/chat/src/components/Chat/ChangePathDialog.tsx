import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation as useNextTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { UseFileManagerActionLabelsOptions } from '@/src/hooks/useFileManagerActionLabels';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getFolderIdFromEntityId,
  getFolderNestingLevel,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import {
  organizationFolderIdToPublishPathSuffix,
  publishToUrlToOrganizationFolderId,
  remapPublicFolderToFilesNamespace,
} from '@/src/utils/app/publications';
import {
  ensureLocaleNamespaceFromStaticFiles,
  isLocaleNamespaceKeyMissing,
} from '@/src/utils/app/translation';

import { FolderInterface } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import { FilesActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ConversationsSelectors,
  FilesSelectors,
  PromptsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import {
  MAX_NESTED_FOLDERS,
  MAX_NEW_FOLDER_PATH_SEGMENTS,
} from '@/src/constants/folders';
import {
  ChatI18nKeys,
  CommonI18nKeys,
  MarketplaceI18nKeys,
  SideBarI18nKeys,
} from '@/src/constants/i18n';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { translateFileManagerChrome } from '@/src/components/FileManager/translateFileManagerChrome';

import {
  FeatureType,
  SharePermission,
  UploadStatus,
} from '@epam/ai-dial-shared';
import {
  type DialCopiedItem,
  type DialDeletedItem,
  DialDestinationFolderPopup,
  type DialFile,
  DialFileManagerActions,
  type DialFileManagerActionsRef,
  DialFileManagerTabs,
  DialFileNodeType,
  DialFilePermission,
  DialUploadFileItem,
  FileManagerGridRow,
} from '@epam/ai-dial-ui-kit';
import {
  CellEditingStartedEvent,
  ColDef,
  FirstDataRenderedEvent,
  GridApi,
  GridReadyEvent,
  IRowNode,
  RowDataUpdatedEvent,
} from 'ag-grid-community';
import uniqBy from 'lodash-es/uniqBy';

const createTemporaryFolder = (folderPath: string): FolderInterface => {
  const segments = folderPath.split('/');
  return {
    id: folderPath,
    folderId: getFolderIdFromEntityId(folderPath),
    name: segments[segments.length - 1],
    type: FeatureType.File,
    status: UploadStatus.LOADED,
    temporary: true,
    publishedWithMe: true,
    permissions: [SharePermission.READ, SharePermission.WRITE],
  };
};

const buildMissingFolderChain = (
  targetPath: string,
  rootId: string,
  existingIds: Set<string>,
): FolderInterface[] => {
  if (targetPath === rootId || !targetPath.startsWith(`${rootId}/`)) return [];

  const relativePath = targetPath.slice(rootId.length + 1);
  const segments = relativePath.split('/');
  const result: FolderInterface[] = [];
  let currentPath = rootId;

  for (const segment of segments) {
    currentPath = `${currentPath}/${segment}`;
    if (!existingIds.has(currentPath)) {
      result.push(createTemporaryFolder(currentPath));
    }
  }

  return result;
};

interface Props {
  isOpen: boolean;
  initiallySelectedFolderId?: string;
  depth?: number;
  onClose: (path: string | false) => void;
  onRenamePath?: (newPath: string) => void;
}

export const ChangePathDialog = ({
  isOpen,
  initiallySelectedFolderId,
  depth = 0,
  onClose,
  onRenamePath,
}: Props) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { i18n } = useNextTranslation();
  const { t } = useTranslation(Translation.Chat);
  const { t: tSidebar } = useTranslation(Translation.SideBar);
  const { t: tCommon } = useTranslation(Translation.Common);
  const { t: tMarketplace } = useTranslation(Translation.Marketplace);

  const translateChrome = useCallback(
    (key: string) =>
      translateFileManagerChrome(key, router.locale, tSidebar, t),
    [router.locale, t, tSidebar],
  );

  const searchPlaceholder = useMemo(
    () => translateChrome(SideBarI18nKeys.FileManagerSearchPlaceholder),
    [translateChrome],
  );

  const hiddenFilesSwitcherLabel = useMemo(
    () => translateChrome(SideBarI18nKeys.HiddenFiles),
    [translateChrome],
  );

  const cancelLabel = tCommon(CommonI18nKeys.Cancel);
  const deleteLabel = tSidebar(SideBarI18nKeys.Delete);
  const addFolderLabel = tCommon(CommonI18nKeys.AddFolder);
  const selectFolderLabel = tCommon(CommonI18nKeys.SelectFolder);
  const organizationRootPath = useMemo(
    () => publishToUrlToOrganizationFolderId(PUBLIC_URL_PREFIX),
    [],
  );
  const organizationBreadcrumbLabel = t(ChatI18nKeys.Organization);
  const [, setSupplementalLabelsVersion] = useState(0);

  useEffect(() => {
    const locale = router.locale ?? 'en';
    if (!isOpen || locale === 'en') {
      return;
    }

    const keys = [ChatI18nKeys.ModifiedDate, ChatI18nKeys.Size];
    const hasMissingKeys = keys.some((key) =>
      isLocaleNamespaceKeyMissing(locale, Translation.Chat, key, i18n),
    );

    if (!hasMissingKeys) {
      return;
    }

    void ensureLocaleNamespaceFromStaticFiles(
      locale,
      Translation.Chat,
      i18n,
    ).then(() => {
      setSupplementalLabelsVersion((version) => version + 1);
    });
  }, [i18n, isOpen, router.locale]);

  const nameColumnLabel = t(ChatI18nKeys.Name);
  const pathColumnLabel = t(ChatI18nKeys.Path);
  const modifiedDateColumnLabel = t(ChatI18nKeys.ModifiedDate);
  const sizeColumnLabel = t(ChatI18nKeys.Size);
  const filesTreeLabel = t(ChatI18nKeys.Files);
  const newFolderBaseName = translateChrome(SideBarI18nKeys.NewFolder);
  const searchEmptyTitle = tCommon(CommonI18nKeys.NoResultsFound);
  const searchEmptyDescription = tMarketplace(
    MarketplaceI18nKeys.NoSearchResults,
  );

  const translateNewFolderName = useCallback(
    (value: string) =>
      /^New folder( \d+)?$/.test(value)
        ? value.replace(/^New folder/, newFolderBaseName)
        : value,
    [newFolderBaseName],
  );

  const gridColumnHeaderLabels = useMemo(
    () => ({
      name: nameColumnLabel,
      path: pathColumnLabel,
      updatedAt: modifiedDateColumnLabel,
      modifiedDate: modifiedDateColumnLabel,
      size: sizeColumnLabel,
    }),
    [
      modifiedDateColumnLabel,
      nameColumnLabel,
      pathColumnLabel,
      sizeColumnLabel,
    ],
  );

  const applyGridHeaderLabels = useCallback(
    (api: GridApi<FileManagerGridRow>) => {
      if (api.isDestroyed()) {
        return;
      }

      const columnDefs = api.getColumnDefs();
      if (!columnDefs?.length) {
        return;
      }

      let updated = false;
      const nextColumnDefs = columnDefs.map((col) => {
        if (!('field' in col) && !('colId' in col)) {
          return col;
        }

        const colId = (col.colId ?? col.field) as
          | keyof typeof gridColumnHeaderLabels
          | undefined;
        const label = colId ? gridColumnHeaderLabels[colId] : undefined;

        if (label && col.headerName !== label) {
          updated = true;
          return { ...col, headerName: label } as ColDef<FileManagerGridRow>;
        }

        return col;
      });

      if (updated) {
        api.setGridOption('columnDefs', nextColumnDefs);
        api.refreshHeader();
      }
    },
    [gridColumnHeaderLabels],
  );

  const englishGridHeaderLabels = useMemo(
    () => ({
      Name: nameColumnLabel,
      Path: pathColumnLabel,
      'Modified Date': modifiedDateColumnLabel,
      Size: sizeColumnLabel,
    }),
    [
      modifiedDateColumnLabel,
      nameColumnLabel,
      pathColumnLabel,
      sizeColumnLabel,
    ],
  );

  const [collapsedTree, setCollapsedTree] = useState(false);
  const fileManagerActionRef = useRef<DialFileManagerActionsRef>(null);
  const addedTempFolderIdsRef = useRef<Set<string>>(new Set());

  const pendingNewFolderIdRef = useRef<string | null>(null);
  const deduplicatedFileIdsRef = useRef<Set<string>>(new Set());

  const resolveTargetNode = useCallback(
    (newNodes: IRowNode<FileManagerGridRow>[]) => {
      const tempNode = newNodes.find((node) => node.data?.isTemporary);
      const pendingId = pendingNewFolderIdRef.current;
      const pendingNode = pendingId
        ? newNodes.find((node) => node.data?.id === pendingId)
        : undefined;

      if (tempNode || pendingNode) {
        pendingNewFolderIdRef.current = null;
        return tempNode ?? pendingNode ?? null;
      }
      return pendingId ? null : (newNodes[0] ?? null);
    },
    [],
  );

  const gridEditingOptions = useMemo(
    () => ({ resolveTargetNode }),
    [resolveTargetNode],
  );

  const filesFolders = useAppSelector(FilesSelectors.selectFolders);
  const filesFoldersRef = useRef(filesFolders);
  filesFoldersRef.current = filesFolders;

  const lastRenamedParentFolder = useAppSelector(
    FilesSelectors.selectLastRenamedParentFolder,
  );

  const resolvedInitialFolderId = useMemo(
    () =>
      publishToUrlToOrganizationFolderId(
        initiallySelectedFolderId ?? PUBLIC_URL_PREFIX,
      ),
    [initiallySelectedFolderId],
  );

  const conversationPublicFolders = useAppSelector(
    ConversationsSelectors.selectPublicFolders,
  );
  const promptPublicFolders = useAppSelector(
    PromptsSelectors.selectPublicFolders,
  );
  const applicationPublicFolders = useAppSelector(
    ApplicationSelectors.selectPublicFolders,
  );
  const filesPublicFolders = useAppSelector(FilesSelectors.selectPublicFolders);
  const toolsetPublicFolders = useAppSelector(
    ToolsetSelectors.selectPublicFolders,
  );

  const additionalOrganizationFolders = useMemo(
    () =>
      uniqBy(
        [
          ...conversationPublicFolders,
          ...promptPublicFolders,
          ...applicationPublicFolders,
          ...filesPublicFolders,
          ...toolsetPublicFolders,
        ].map(remapPublicFolderToFilesNamespace),
        'id',
      ),
    [
      conversationPublicFolders,
      promptPublicFolders,
      applicationPublicFolders,
      filesPublicFolders,
      toolsetPublicFolders,
    ],
  );

  const actionLabelsOptions = useMemo<UseFileManagerActionLabelsOptions>(
    () => ({
      actionsByTab: {
        my_files: [],
        shared: [],
        organization: [
          DialFileManagerActions.Rename,
          DialFileManagerActions.Delete,
        ],
        review: [],
      },
    }),
    [],
  );

  const {
    currentPath,
    setCurrentPath,
    areFoldersLoading,
    fileTreeItems,
    rootFolder,
    treeOptions,
    gridOptions,
    navigationPanelOptions,
    handleRenameValidation,
    isMaxFolderDepthReached,
    showMaxDepthError,
    resetGridEditing,
    emptyStateTitle,
    emptyStateDescription,
    deleteConfirmationOptions,
  } = useFileManager({
    initialTab: DialFileManagerTabs.Organization,
    actionLabelsOptions,
    toolbarOptions: {
      tabs: [],
      showHiddenFilesToggle: false,
      isNewButtonDisabled: true,
    },
    availableTabs: new Set([DialFileManagerTabs.Organization]),
    additionalFilesAndFolders: {
      files: [],
      folders: additionalOrganizationFolders,
    },
    gridEditingOptions,
    folderDepthOffset: depth,
  });

  const publishedFolderIds = useMemo(
    () =>
      new Set(
        additionalOrganizationFolders
          .filter((f) => !f.temporary)
          .map((f) => f.id),
      ),
    [additionalOrganizationFolders],
  );

  const isTempFolder = useCallback(
    (id: string) => {
      if (publishedFolderIds.has(id)) return false;
      return (
        addedTempFolderIdsRef.current.has(id) ||
        [...addedTempFolderIdsRef.current].some((rootId) =>
          id.startsWith(`${rootId}/`),
        )
      );
    },
    [publishedFolderIds],
  );

  const handleOrganizationRenameValidation = useCallback(
    (value: string, item: DialFile) =>
      item.path && !isTempFolder(item.path)
        ? ''
        : handleRenameValidation(value, item),
    [isTempFolder, handleRenameValidation],
  );

  const handleOrganizationMoveFiles = useCallback(
    (
      movedItems: DialCopiedItem[],
      sourceFolder: string,
      destinationFolder: string,
    ) => {
      if (sourceFolder !== destinationFolder) return;

      for (const { sourceUrl, destinationUrl } of movedItems) {
        if (!isTempFolder(sourceUrl)) continue;
        const newName = destinationUrl.split('/').pop();
        if (!newName) continue;
        dispatch(FilesActions.renameFolder({ folderId: sourceUrl, newName }));
        addedTempFolderIdsRef.current.delete(sourceUrl);
        addedTempFolderIdsRef.current.add(destinationUrl);
      }
    },
    [dispatch, isTempFolder],
  );

  const handleDeleteTempFolders = useCallback(
    (items: DialDeletedItem[], _sourceFolder: string) => {
      const tempRootIds = items
        .map((i) => i.sourceUrl)
        .filter((id) => addedTempFolderIdsRef.current.has(id));

      if (!tempRootIds.length) return;

      deduplicatedFileIdsRef.current.clear();

      [...addedTempFolderIdsRef.current]
        .filter((id) =>
          tempRootIds.some(
            (rootId) => id === rootId || id.startsWith(`${rootId}/`),
          ),
        )
        .forEach((id) => addedTempFolderIdsRef.current.delete(id));

      dispatch(
        FilesActions.setFolders({
          folders: filesFoldersRef.current.filter(
            (f) =>
              !tempRootIds.some(
                (rootId) => f.id === rootId || f.id.startsWith(`${rootId}/`),
              ),
          ),
        }),
      );

      setCurrentPath((prev) => {
        if (!prev) return prev;
        return tempRootIds.some(
          (id) => prev === id || prev.startsWith(`${id}/`),
        )
          ? resolvedInitialFolderId
          : prev;
      });
    },
    [dispatch, resolvedInitialFolderId, setCurrentPath],
  );

  useEffect(() => {
    if (isOpen) {
      for (const folder of filesFoldersRef.current) {
        if (folder.temporary && !addedTempFolderIdsRef.current.has(folder.id)) {
          addedTempFolderIdsRef.current.add(folder.id);
        }
      }

      setCurrentPath(resolvedInitialFolderId);
    }
  }, [isOpen, resolvedInitialFolderId, setCurrentPath]);

  useEffect(() => {
    if (!lastRenamedParentFolder) return;

    const { oldId, newId } = lastRenamedParentFolder;
    if (!newId || !oldId) return;

    const initialPath = initiallySelectedFolderId ?? PUBLIC_URL_PREFIX;
    let newInitialPath = initialPath;
    if (initialPath === oldId) newInitialPath = newId;
    else if (initialPath.startsWith(`${oldId}/`))
      newInitialPath = updateMovedFolderId(oldId, newId, initialPath);

    if (newInitialPath !== initialPath) {
      onRenamePath?.(
        organizationFolderIdToPublishPathSuffix(newInitialPath) ?? '',
      );
    }

    setCurrentPath((prevPath) => {
      if (!prevPath) return prevPath;

      if (prevPath === oldId) return newId;
      if (prevPath.startsWith(`${oldId}/`))
        return updateMovedFolderId(oldId, newId, prevPath);
      return prevPath;
    });

    dispatch(FilesActions.resetLastRenamedParentFolder());
  }, [
    dispatch,
    lastRenamedParentFolder,
    setCurrentPath,
    initiallySelectedFolderId,
    onRenamePath,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    dispatch(FilesActions.getFoldersList({ paths: [undefined] }));

    if (!resolvedInitialFolderId) return;

    const rootId = publishToUrlToOrganizationFolderId(PUBLIC_URL_PREFIX);
    const existingIds = new Set(filesFoldersRef.current.map((f) => f.id));
    const missingFolders = buildMissingFolderChain(
      resolvedInitialFolderId,
      rootId,
      existingIds,
    );

    if (missingFolders.length === 0) return;

    for (const folder of missingFolders) {
      addedTempFolderIdsRef.current.add(folder.id);
    }
    dispatch(FilesActions.addFolders({ folders: missingFolders }));
  }, [dispatch, isOpen, resolvedInitialFolderId]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    deduplicatedFileIdsRef.current.clear();
    pendingNewFolderIdRef.current = null;
    resetGridEditing();
    dispatch(FilesActions.resetNewFolderId());

    if (addedTempFolderIdsRef.current.size > 0) {
      const tempIds = addedTempFolderIdsRef.current;
      dispatch(
        FilesActions.setFolders({
          folders: filesFoldersRef.current.filter(
            (f) =>
              !tempIds.has(f.id) &&
              ![...tempIds].some((tempId) => f.id.startsWith(`${tempId}/`)),
          ),
        }),
      );
      addedTempFolderIdsRef.current.clear();
    }
  }, [dispatch, isOpen, resetGridEditing]);

  const handleCreateFolderValidate = useCallback(
    (name: string, parentFolder: DialFile) => {
      if (isMaxFolderDepthReached(parentFolder.id)) {
        return t(ChatI18nKeys.NotAllowedMoreNestedFolders);
      }
      return handleRenameValidation(name, parentFolder);
    },
    [handleRenameValidation, isMaxFolderDepthReached, t],
  );

  const handleCreateOrganizationFolder = useCallback(
    (file: DialUploadFileItem, folderPath: string, fileId: string) => {
      if (deduplicatedFileIdsRef.current.has(fileId)) return;

      if (filesFoldersRef.current.some((f) => f.id === folderPath)) return;

      const folder = createTemporaryFolder(folderPath);
      if (!folder.name) return;

      const parentId = getFolderIdFromEntityId(folderPath);
      const parentEntity = filesFoldersRef.current.find(
        (f) => f.id === parentId,
      );
      const parentFolder: DialFile = {
        id: parentId,
        path: parentId,
        folderId: parentId,
        name: parentEntity?.name ?? rootFolder.name ?? '',
        nodeType: DialFileNodeType.FOLDER,
      };

      if (handleCreateFolderValidate(file.name, parentFolder)) return;

      deduplicatedFileIdsRef.current.add(fileId);
      addedTempFolderIdsRef.current.add(folderPath);
      pendingNewFolderIdRef.current = folderPath;
      dispatch(FilesActions.addFolders({ folders: [folder] }));
    },
    [dispatch, handleCreateFolderValidate, rootFolder],
  );

  const itemsToRender = useMemo(() => {
    const applyTreePermissions = (items: DialFile[]): DialFile[] =>
      items.map((item) => {
        const isTemp = isTempFolder(item.path);
        return {
          ...item,
          parentPath: isTemp ? item.parentPath : null,
          permissions: isTemp ? item.permissions : [DialFilePermission.READ],
          items: item.items ? applyTreePermissions(item.items) : item.items,
        };
      });

    return applyTreePermissions(fileTreeItems);
  }, [isTempFolder, fileTreeItems]);

  const handleClose = useCallback(() => onClose(false), [onClose]);

  const handleConfirm = useCallback(() => {
    const folderId = currentPath ?? resolvedInitialFolderId;
    const suffix = organizationFolderIdToPublishPathSuffix(folderId);

    if (getFolderNestingLevel(folderId) + depth > MAX_NESTED_FOLDERS) {
      dispatch(
        UIActions.showErrorToast({
          message: t(ChatI18nKeys.NotAllowedMoreNestedFolders),
        }),
      );
      return;
    }

    onClose(suffix ?? '');
  }, [currentPath, resolvedInitialFolderId, depth, dispatch, onClose, t]);

  const modalTreeOptions = useMemo(
    () => ({
      collapsed: collapsedTree,
      onCollapseChange: setCollapsedTree,
      header: filesTreeLabel,
      actionLabels: treeOptions.actionLabels,
      loadedPaths: treeOptions.loadedPaths,
      newFolderDefaultName: newFolderBaseName,
    }),
    [
      collapsedTree,
      filesTreeLabel,
      newFolderBaseName,
      treeOptions.actionLabels,
      treeOptions.loadedPaths,
    ],
  );

  const translateNewFolderNode = useCallback(
    (node: Pick<IRowNode<FileManagerGridRow>, 'data' | 'setDataValue'>) => {
      const folderName = node.data?.name;
      if (folderName && /^New folder( \d+)?$/.test(folderName)) {
        node.setDataValue('name', translateNewFolderName(folderName));
      }
    },
    [translateNewFolderName],
  );

  const modalGridOptions = useMemo(
    () => ({
      ...gridOptions,
      showFiles: false,
      emptyStateTitle: searchEmptyTitle,
      emptyStateDescription: searchEmptyDescription,
      additionalGridOptions: {
        ...gridOptions.additionalGridOptions,
        emptyStateTitle: searchEmptyTitle,
        emptyStateDescription: searchEmptyDescription,
        onGridReady: (params: GridReadyEvent<FileManagerGridRow>) => {
          applyGridHeaderLabels(params.api);
          gridOptions.additionalGridOptions?.onGridReady?.(params);
        },
        onFirstDataRendered: (
          params: FirstDataRenderedEvent<FileManagerGridRow>,
        ) => {
          applyGridHeaderLabels(params.api);
          gridOptions.additionalGridOptions?.onFirstDataRendered?.(params);
        },
        onCellEditingStarted: (params: CellEditingStartedEvent) => {
          if (params.node) translateNewFolderNode(params.node);
          gridOptions.additionalGridOptions?.onCellEditingStarted?.(params);
        },
        onRowDataUpdated: (params: RowDataUpdatedEvent) => {
          params.api.forEachNode(translateNewFolderNode);
          applyGridHeaderLabels(params.api);
          gridOptions.additionalGridOptions?.onRowDataUpdated?.(params);
        },
      },
    }),
    [
      applyGridHeaderLabels,
      gridOptions,
      searchEmptyDescription,
      searchEmptyTitle,
      translateNewFolderNode,
    ],
  );

  const modalRootFolder = useMemo(
    () => ({
      ...rootFolder,
      path: organizationRootPath,
      label: organizationBreadcrumbLabel,
    }),
    [organizationBreadcrumbLabel, organizationRootPath, rootFolder],
  );

  const modalNavigationPanelOptions = useMemo(
    () => ({
      ...navigationPanelOptions,
      rootItemPath: organizationRootPath,
      rootItemLabel: organizationBreadcrumbLabel,
    }),
    [navigationPanelOptions, organizationBreadcrumbLabel, organizationRootPath],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let rafId = 0;
    let popupObserver: MutationObserver | null = null;
    let setupObserver: MutationObserver | null = null;

    const applyDestinationPopupChrome = (popupRoot: Element) => {
      const searchInput = document.getElementById(
        'file-manager-destination-search',
      );

      if (
        searchInput instanceof HTMLInputElement &&
        searchInput.placeholder !== searchPlaceholder
      ) {
        searchInput.placeholder = searchPlaceholder;
      }

      const switchRoot = document.getElementById('hidden-files-switch-modal');
      const popupFooter = switchRoot?.closest('.flex.justify-between');
      const footerActions = popupFooter?.querySelector('.flex.space-x-4');
      const cancelButton =
        footerActions?.querySelector<HTMLButtonElement>('button');

      if (cancelButton?.textContent?.trim() === 'Cancel') {
        cancelButton.textContent = cancelLabel;
      }

      if (footerActions instanceof HTMLElement) {
        footerActions.style.gap = '1rem';
        footerActions.querySelectorAll(':scope > *').forEach((child) => {
          if (child instanceof HTMLElement) {
            child.style.marginLeft = '0';
            child.style.marginRight = '0';
          }
        });
      }

      const switchLabelContainer =
        switchRoot?.parentElement?.querySelector('div.ml-2');
      if (switchLabelContainer instanceof HTMLElement) {
        switchLabelContainer.style.marginLeft = '0';
        switchLabelContainer.style.marginRight = '0';
        switchLabelContainer.style.marginInlineStart = '0.5rem';
      }

      popupRoot
        .querySelectorAll('.ag-header-cell-text, .ag-header-cell-label')
        .forEach((node) => {
          const text = node.textContent?.trim();
          const translated =
            text &&
            englishGridHeaderLabels[
              text as keyof typeof englishGridHeaderLabels
            ];
          if (translated && text !== translated) {
            node.textContent = translated;
          }
        });

      popupRoot.querySelectorAll('span, div, button').forEach((node) => {
        if (node.childElementCount > 0) {
          return;
        }
        if (node.textContent?.trim() === 'Files') {
          node.textContent = filesTreeLabel;
        }
      });

      popupRoot.querySelectorAll('.ag-header-cell[col-id]').forEach((cell) => {
        const colId = cell.getAttribute('col-id');
        const label =
          colId &&
          gridColumnHeaderLabels[colId as keyof typeof gridColumnHeaderLabels];
        if (!label) {
          return;
        }

        const headerText = cell.querySelector('.ag-header-cell-text');
        if (headerText && headerText.textContent?.trim() !== label) {
          headerText.textContent = label;
        }
      });

      const englishHeaderTextReplacements: Record<string, string> = {
        Files: filesTreeLabel,
        files: filesTreeLabel,
        Name: nameColumnLabel,
        Path: pathColumnLabel,
        'Modified Date': modifiedDateColumnLabel,
        Size: sizeColumnLabel,
      };
      const textWalker = document.createTreeWalker(
        popupRoot,
        NodeFilter.SHOW_TEXT,
      );
      let textNode: Node | null = textWalker.nextNode();

      while (textNode) {
        const trimmed = textNode.textContent?.trim();
        const replacement = trimmed && englishHeaderTextReplacements[trimmed];

        if (replacement && trimmed !== replacement) {
          const parentElement =
            textNode.parentElement instanceof HTMLElement
              ? textNode.parentElement
              : null;

          if (trimmed === 'Files') {
            if (!parentElement?.closest('.ag-cell')) {
              textNode.textContent = replacement;
            }
          } else if (trimmed === 'files') {
            if (
              !parentElement?.closest('.ag-cell') &&
              !parentElement?.closest('.ag-header-cell')
            ) {
              textNode.textContent = replacement;
            }
          } else if (trimmed === 'Size') {
            if (parentElement?.closest('.ag-header-cell')) {
              textNode.textContent = replacement;
            }
          } else if (parentElement?.closest('.ag-header-cell')) {
            textNode.textContent = replacement;
          }
        }

        textNode = textWalker.nextNode();
      }

      popupRoot.querySelectorAll('[col-id="name"]').forEach((cell) => {
        cell
          .querySelectorAll<HTMLInputElement>(
            'input:not([type="checkbox"]):not([type="hidden"]):not([type="radio"])',
          )
          .forEach((input) => {
            const translated = translateNewFolderName(input.value.trim());
            if (translated !== input.value.trim()) {
              input.value = translated;
            }
          });

        cell.querySelectorAll('.ag-cell-value, span').forEach((node) => {
          if (node.childElementCount > 0) {
            return;
          }
          const label = node.textContent?.trim();
          if (!label) {
            return;
          }
          const translated = translateNewFolderName(label);
          if (translated !== label) {
            node.textContent = translated;
          }
        });
      });

      document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
        dialog.querySelectorAll('button').forEach((button) => {
          const label = button.textContent?.trim();
          if (label === 'Delete') {
            button.textContent = deleteLabel;
          } else if (label === 'Cancel') {
            button.textContent = cancelLabel;
          }
        });
      });
    };

    const findPopupRoot = (): Element | null => {
      const searchInput = document.getElementById(
        'file-manager-destination-search',
      );
      return (
        searchInput?.closest('[role="dialog"]') ??
        searchInput?.closest('.min-h-\\[500px\\]') ??
        document
          .getElementById('hidden-files-switch-modal')
          ?.closest('[role="dialog"]') ??
        null
      );
    };

    const attachPopupObserver = (popupRoot: Element) => {
      if (popupObserver) {
        return;
      }

      applyDestinationPopupChrome(popupRoot);

      popupObserver = new MutationObserver(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          applyDestinationPopupChrome(popupRoot);
        });
      });

      popupObserver.observe(popupRoot, {
        childList: true,
        subtree: true,
      });
    };

    const tryAttach = () => {
      const popupRoot = findPopupRoot();
      if (popupRoot) {
        setupObserver?.disconnect();
        setupObserver = null;
        attachPopupObserver(popupRoot);
      }
    };

    tryAttach();

    if (!popupObserver) {
      setupObserver = new MutationObserver(() => {
        tryAttach();
      });
      setupObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(rafId);
      popupObserver?.disconnect();
      setupObserver?.disconnect();
    };
  }, [
    cancelLabel,
    deleteConfirmationOptions,
    deleteLabel,
    englishGridHeaderLabels,
    filesTreeLabel,
    gridColumnHeaderLabels,
    isOpen,
    modifiedDateColumnLabel,
    nameColumnLabel,
    pathColumnLabel,
    router.locale,
    sizeColumnLabel,
    searchPlaceholder,
    translateNewFolderName,
  ]);

  return (
    <div>
      <DialDestinationFolderPopup
        className="min-h-[500px] min-w-[700px]"
        open={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        mode="move"
        moveLabel={selectFolderLabel}
        addFolderLabel={addFolderLabel}
        hiddenFilesSwitcherLabel={hiddenFilesSwitcherLabel}
        emptyStateTitle={emptyStateTitle}
        emptyStateDescription={emptyStateDescription}
        header={t(ChatI18nKeys.ChangePath)}
        path={currentPath}
        onFolderPopupPathChange={setCurrentPath}
        items={itemsToRender}
        rootItem={modalRootFolder}
        filesLoading={areFoldersLoading}
        treeOptions={modalTreeOptions}
        gridOptions={modalGridOptions}
        navigationPanelOptions={modalNavigationPanelOptions}
        collapsedFileTree={collapsedTree}
        allowedFileTypes={[]}
        actionsRef={fileManagerActionRef}
        onCreateFolder={handleCreateOrganizationFolder}
        onMoveToFiles={handleOrganizationMoveFiles}
        onCreateFolderValidate={handleCreateFolderValidate}
        maxNewFolderDepth={MAX_NEW_FOLDER_PATH_SEGMENTS - depth}
        onNewFolderDepthExceeded={showMaxDepthError}
        onRenameValidate={handleOrganizationRenameValidation}
        onDeleteFiles={handleDeleteTempFolders}
        deleteConfirmationOptions={deleteConfirmationOptions}
        uploadEnabled={false}
        showHiddenFileSwitcher
      />
    </div>
  );
};
