import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { useTranslation } from '@/src/hooks/useTranslation';

import { updateMovedFolderId } from '@/src/utils/app/folders';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import {
  AlertVariant,
  DialDestinationFolderPopup,
  type DialFileManagerActionsRef,
} from '@epam/ai-dial-ui-kit';

interface Props {
  isOpen: boolean;
  initialSelectedFolderId?: string;
  rootFolderId: string;
  onClose: (path: string | undefined) => void;
  disallowSelectRootFolder?: boolean;
  warningMessage?: string;
}

export const SelectFolderModal = ({
  isOpen,
  initialSelectedFolderId,
  rootFolderId,
  onClose,
  disallowSelectRootFolder,
  warningMessage,
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

  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    defaultSelectedFolder,
  );

  const lastRenamedParentFolder = useAppSelector(
    FilesSelectors.selectLastRenamedParentFolder,
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
  } = useFileManager({
    actionLabelsOptions: {
      actionsByTab: {
        my_files: [],
        shared: [],
        organization: [],
      },
    },
    toolbarOptions: {
      tabs: [],
      showHiddenFilesToggle: false,
      isNewButtonDisabled: true,
    },
    availableTabs: new Set(['my_files']),
  });

  useEffect(() => {
    if (lastRenamedParentFolder?.newId) {
      setSelectedFolderId((id) => {
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
  ]);

  useEffect(() => {
    if (isOpen) {
      dispatch(
        FilesActions.getFoldersList({
          paths: [undefined],
        }),
      );
    }
  }, [dispatch, isOpen, rootFolderId]);

  useEffect(() => {
    if (!isOpen) {
      dispatch(FilesActions.resetNewFolderId());
    }
  }, [dispatch, isOpen]);

  useEffect(() => {
    if (currentPath) {
      setSelectedFolderId(currentPath);
    }
  }, [currentPath]);

  const handleClose = useCallback(() => {
    onClose(undefined);
    setSelectedFolderId(defaultSelectedFolder);
  }, [onClose, defaultSelectedFolder]);

  const handleConfirm = useCallback(() => {
    onClose(selectedFolderId);
  }, [onClose, selectedFolderId]);

  return (
    <DialDestinationFolderPopup
      open={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      mode="move"
      moveLabel={t('Select folder')}
      addFolderLabel={t('Add folder')}
      header={t('Select folder')}
      path={currentPath}
      onPathChange={setCurrentPath}
      sourceFolder={rootFolderId}
      disabledPathTooltip={t('Root folder cannot be selected') }
      items={fileTreeItems}
      rootItem={rootFolder}
      filesLoading={areFoldersLoading}
      treeOptions={{
        collapsed: collapsedTree,
        onCollapseChange: setCollapsedTree,
        header: treeOptions.header,
      }}
      gridOptions={{ ...gridOptions }}
      navigationPanelOptions={navigationPanelOptions}
      collapsedFileTree={collapsedTree}
      allowedFileTypes={[]}
      actionsRef={fileManagerActionRef}
      onCreateFolder={handleCreateFolder}
      onMoveToFiles={handleMoveFiles}
      uploadEnabled={false}
      alertProps={
        warningMessage
          ? { message: warningMessage, variant: AlertVariant.Warning }
          : undefined
      }
    />
  );
};
