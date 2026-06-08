import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { UseFileManagerActionLabelsOptions } from '@/src/hooks/useFileManagerActionLabels';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getFolderIdFromEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import {
  getOrganizationPublishPathDepth,
  organizationFolderIdToPublishPathSuffix,
  publishToUrlToOrganizationFolderId,
  remapPublicFolderToFilesNamespace,
} from '@/src/utils/app/publications';

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

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';
import { ChatI18nKeys, CommonI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

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
  DialUploadFileItem,
  FileManagerGridRow,
} from '@epam/ai-dial-ui-kit';
import {
  CellEditingStartedEvent,
  CellEditingStoppedEvent,
  GridApi,
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

const findRowElement = (
  node: IRowNode<FileManagerGridRow>,
): HTMLElement | null => {
  if (node.id) {
    const byId = document.querySelector<HTMLElement>(`[row-id="${node.id}"]`);
    if (byId) return byId;
  }
  if (node.rowIndex != null) {
    return document.querySelector<HTMLElement>(
      `[row-index="${node.rowIndex}"]`,
    );
  }
  return null;
};

const scrollRowIntoView = (
  api: GridApi<FileManagerGridRow>,
  node: IRowNode<FileManagerGridRow>,
): void => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!api.isDestroyed() && node.rowIndex != null) {
        api.ensureNodeVisible(node, 'middle');
      }

      findRowElement(node)?.scrollIntoView({
        block: 'center',
        behavior: 'auto',
      });
    });
  });
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
  const { t } = useTranslation(Translation.Chat);

  const [collapsedTree, setCollapsedTree] = useState(false);
  const fileManagerActionRef = useRef<DialFileManagerActionsRef>(null);
  const addedTempFolderIdsRef = useRef<Set<string>>(new Set());

  const knownRowIdsRef = useRef<Set<string>>(new Set());
  const knownRowIdsInitializedRef = useRef(false);
  const pendingNewFolderIdRef = useRef<string | null>(null);

  const [isGridEditing, setIsGridEditing] = useState(false);
  const deduplicatedFileIdsRef = useRef<Set<string>>(new Set());

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
  });

  const isTempFolder = useCallback(
    (id: string) =>
      addedTempFolderIdsRef.current.has(id) ||
      [...addedTempFolderIdsRef.current].some((rootId) =>
        id.startsWith(`${rootId}/`),
      ),
    [],
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
    knownRowIdsRef.current = new Set();
    knownRowIdsInitializedRef.current = false;
    pendingNewFolderIdRef.current = null;
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
  }, [dispatch, isOpen]);

  const handleCreateOrganizationFolder = useCallback(
    (_file: DialUploadFileItem, folderPath: string, fileId: string) => {
      if (deduplicatedFileIdsRef.current.has(fileId)) return;
      deduplicatedFileIdsRef.current.add(fileId);

      if (filesFoldersRef.current.some((f) => f.id === folderPath)) return;

      const folder = createTemporaryFolder(folderPath);
      if (!folder.name) return;

      addedTempFolderIdsRef.current.add(folderPath);
      pendingNewFolderIdRef.current = folderPath;
      dispatch(FilesActions.addFolders({ folders: [folder] }));
    },
    [dispatch],
  );

  const handleCreateFolderValidate = useCallback(
    (name: string, parentFolder: DialFile) => {
      const pathDepth = getOrganizationPublishPathDepth(parentFolder.id);
      if (pathDepth + 1 + depth > MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH) {
        return t(ChatI18nKeys.NotAllowedMoreNestedFolders);
      }
      return handleRenameValidation(name, parentFolder);
    },
    [depth, handleRenameValidation, t],
  );

  const frozenFileTreeItemsRef = useRef(fileTreeItems);
  useEffect(() => {
    if (!isGridEditing) {
      frozenFileTreeItemsRef.current = fileTreeItems;
    }
  }, [fileTreeItems, isGridEditing]);

  const rawItemsToRender = isGridEditing
    ? frozenFileTreeItemsRef.current
    : fileTreeItems;

  const applyTreePermissions = useCallback(
    (items: DialFile[]): DialFile[] =>
      items.map((item) => ({
        ...item,
        parentPath: isTempFolder(item.path) ? item.parentPath : null,
        items: item.items ? applyTreePermissions(item.items) : item.items,
      })),
    [isTempFolder],
  );

  const itemsToRender = useMemo(
    () => applyTreePermissions(rawItemsToRender),
    [applyTreePermissions, rawItemsToRender],
  );

  const handleClose = useCallback(() => onClose(false), [onClose]);

  const handleConfirm = useCallback(() => {
    const folderId = currentPath ?? resolvedInitialFolderId;
    const suffix = organizationFolderIdToPublishPathSuffix(folderId);
    const pathDepth = getOrganizationPublishPathDepth(folderId);

    if (pathDepth + depth > MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH) {
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
      header: treeOptions.header,
      actionLabels: treeOptions.actionLabels,
    }),
    [collapsedTree, treeOptions.header, treeOptions.actionLabels],
  );

  const modalGridOptions = useMemo(
    () => ({
      ...gridOptions,
      showFiles: false,
      additionalGridOptions: {
        ...gridOptions.additionalGridOptions,
        suppressRowVirtualisation: true,
        onCellEditingStarted: (params: CellEditingStartedEvent) => {
          setIsGridEditing(true);
          if (params.api) {
            setTimeout(() => {
              params.api.ensureIndexVisible(params.rowIndex as number);
            }, 0);
          }
          gridOptions.additionalGridOptions?.onCellEditingStarted?.(params);
        },
        onCellEditingStopped: (params: CellEditingStoppedEvent) => {
          setIsGridEditing(false);
          gridOptions.additionalGridOptions?.onCellEditingStopped?.(params);
        },
        onRowDataUpdated: (params: RowDataUpdatedEvent) => {
          const currentIds = new Set<string>();
          let firstNewNode: IRowNode<FileManagerGridRow> | null = null;
          let tempNewNode: IRowNode<FileManagerGridRow> | null = null;
          let pendingNode: IRowNode<FileManagerGridRow> | null = null;
          const pendingId = pendingNewFolderIdRef.current;

          params.api.forEachNode((node) => {
            const id = node.data?.id;
            if (!id) return;
            currentIds.add(id);

            if (
              knownRowIdsInitializedRef.current &&
              !knownRowIdsRef.current.has(id)
            ) {
              if (!firstNewNode) firstNewNode = node;
              if (node.data?.isTemporary) tempNewNode = node;
              if (pendingId && id === pendingId) pendingNode = node;
            }
          });

          knownRowIdsRef.current = currentIds;
          knownRowIdsInitializedRef.current = true;

          if (tempNewNode) {
            pendingNewFolderIdRef.current = null;
            scrollRowIntoView(params.api, tempNewNode);
          } else if (pendingNode) {
            pendingNewFolderIdRef.current = null;
            scrollRowIntoView(params.api, pendingNode);
          } else if (firstNewNode && !pendingId) {
            scrollRowIntoView(params.api, firstNewNode);
          }

          gridOptions.additionalGridOptions?.onRowDataUpdated?.(params);
        },
      },
    }),
    [gridOptions],
  );

  return (
    <div>
      <DialDestinationFolderPopup
        className="min-h-[500px] min-w-[700px]"
        open={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        mode="move"
        moveLabel={t(CommonI18nKeys.SelectFolder)}
        addFolderLabel={t(CommonI18nKeys.AddFolder)}
        header={t(ChatI18nKeys.ChangePath)}
        path={currentPath}
        onFolderPopupPathChange={setCurrentPath}
        items={itemsToRender}
        rootItem={rootFolder}
        filesLoading={areFoldersLoading}
        treeOptions={modalTreeOptions}
        gridOptions={modalGridOptions}
        navigationPanelOptions={navigationPanelOptions}
        collapsedFileTree={collapsedTree}
        allowedFileTypes={[]}
        actionsRef={fileManagerActionRef}
        onCreateFolder={handleCreateOrganizationFolder}
        onMoveToFiles={handleOrganizationMoveFiles}
        onCreateFolderValidate={handleCreateFolderValidate}
        onRenameValidate={handleOrganizationRenameValidation}
        onDeleteFiles={handleDeleteTempFolders}
        uploadEnabled={false}
        showHiddenFileSwitcher
      />
    </div>
  );
};
