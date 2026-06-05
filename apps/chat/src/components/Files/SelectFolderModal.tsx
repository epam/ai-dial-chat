import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { UseFileManagerActionLabelsOptions } from '@/src/hooks/useFileManagerActionLabels';
import { useTranslation } from '@/src/hooks/useTranslation';

import { updateMovedFolderId } from '@/src/utils/app/folders';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';

import {
  DialDestinationFolderPopup,
  DialFileManagerActions,
  type DialFileManagerActionsRef,
  DialFileManagerTabs,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import {
  CellEditingStartedEvent,
  CellEditingStoppedEvent,
} from 'ag-grid-community';

const defaultTabs = new Set([DialFileManagerTabs.MyFiles]);
const reviewTabs = new Set([DialFileManagerTabs.Review]);

interface Props {
  isOpen: boolean;
  initialSelectedFolderId?: string;
  rootFolderId: string;
  onClose: (path: string | undefined) => void;
  disallowSelectRootFolder?: boolean;
  warningMessage?: string;
  reviewBucket?: string;
}

export const SelectFolderModal = ({
  isOpen,
  initialSelectedFolderId,
  rootFolderId,
  onClose,
  disallowSelectRootFolder,
  warningMessage,
  reviewBucket,
}: Props) => {
  const dispatch = useAppDispatch();
  const fileManagerActionRef = useRef<DialFileManagerActionsRef>(null);
  const { t } = useTranslation(Translation.Common);
  const [collapsedTree, setCollapsedTree] = useState(false);

  const defaultSelectedFolder = useMemo(() => {
    return (
      initialSelectedFolderId ??
      (!disallowSelectRootFolder ? rootFolderId : undefined)
    );
  }, [disallowSelectRootFolder, initialSelectedFolderId, rootFolderId]);

  const lastRenamedParentFolder = useAppSelector(
    FilesSelectors.selectLastRenamedParentFolder,
  );

  const [isGridEditing, setIsGridEditing] = useState(false);

  const isReview = splitEntityId(rootFolderId).bucket === reviewBucket;

  const actionLabelsOptions = useMemo<UseFileManagerActionLabelsOptions>(
    () => ({
      actionsByTab: {
        my_files: [
          DialFileManagerActions.Rename,
          DialFileManagerActions.Delete,
        ],
        shared: [],
        organization: [],
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
    handleCreateFolder,
    handleMoveFiles,
    handleRenameValidation,
    handleDeleteFiles,
  } = useFileManager({
    actionLabelsOptions,
    toolbarOptions: {
      tabs: [],
      showHiddenFilesToggle: false,
      isNewButtonDisabled: true,
    },
    availableTabs: isReview ? reviewTabs : defaultTabs,
    reviewBucket,
  });

  useEffect(() => {
    if (isOpen) {
      setCurrentPath(defaultSelectedFolder);
    }
  }, [isOpen, defaultSelectedFolder, setCurrentPath]);

  useEffect(() => {
    if (lastRenamedParentFolder?.newId) {
      setCurrentPath((id) => {
        if (!id) return id;

        if (id === lastRenamedParentFolder.oldId)
          return lastRenamedParentFolder.newId;
        if (id.startsWith(`${lastRenamedParentFolder.oldId}/`))
          return updateMovedFolderId(
            lastRenamedParentFolder.oldId,
            lastRenamedParentFolder.newId,
            id,
          );
        return id;
      });
      dispatch(FilesActions.resetLastRenamedParentFolder());
    }
  }, [
    dispatch,
    lastRenamedParentFolder?.newId,
    lastRenamedParentFolder?.oldId,
    setCurrentPath,
  ]);

  useEffect(() => {
    if (isOpen) {
      dispatch(
        FilesActions.getFoldersList({
          paths: [undefined],
        }),
      );
    }
  }, [dispatch, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      dispatch(FilesActions.resetNewFolderId());
    }
  }, [dispatch, isOpen]);

  useEffect(() => {
    if (isOpen && rootFolderId) {
      dispatch(FilesActions.getFolders({ id: rootFolderId }));
    }
  }, [dispatch, isOpen, rootFolderId]);

  const frozenFileTreeItemsRef = useRef(fileTreeItems);
  useEffect(() => {
    if (!isGridEditing) {
      frozenFileTreeItemsRef.current = fileTreeItems;
    }
  }, [fileTreeItems, isGridEditing]);

  const itemsToRender = isGridEditing
    ? frozenFileTreeItemsRef.current
    : fileTreeItems;

  const handleClose = useCallback(() => {
    onClose(undefined);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onClose(currentPath ?? defaultSelectedFolder);
  }, [onClose, currentPath, defaultSelectedFolder]);

  const modalTreeOptions = useMemo(
    () => ({
      collapsed: collapsedTree,
      onCollapseChange: setCollapsedTree,
      header: treeOptions.header,
      showFiles: false,
    }),
    [collapsedTree, treeOptions.header],
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
      },
    }),
    [gridOptions],
  );

  return (
    <div>
      <DialDestinationFolderPopup
        open={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        mode="move"
        moveLabel={t(CommonI18nKeys.SelectFolder)}
        addFolderLabel={t(CommonI18nKeys.AddFolder)}
        header={t(CommonI18nKeys.SelectFolder)}
        path={currentPath}
        onFolderPopupPathChange={setCurrentPath}
        sourceFolder={rootFolderId}
        disabledPathTooltip={t(CommonI18nKeys.RootFolderCannotBeSelected)}
        items={itemsToRender}
        rootItem={rootFolder}
        filesLoading={areFoldersLoading}
        treeOptions={modalTreeOptions}
        gridOptions={modalGridOptions}
        navigationPanelOptions={navigationPanelOptions}
        collapsedFileTree={collapsedTree}
        allowedFileTypes={[]}
        actionsRef={fileManagerActionRef}
        onCreateFolder={handleCreateFolder}
        onMoveToFiles={handleMoveFiles}
        onCreateFolderValidate={handleRenameValidation}
        onRenameValidate={handleRenameValidation}
        onDeleteFiles={handleDeleteFiles}
        uploadEnabled={false}
        alertProps={
          warningMessage
            ? { message: warningMessage, variant: NotificationVariant.Warning }
            : undefined
        }
      />
    </div>
  );
};
