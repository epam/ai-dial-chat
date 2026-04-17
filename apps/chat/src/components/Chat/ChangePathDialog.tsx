import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { useTranslation } from '@/src/hooks/useTranslation';

import { updateMovedFolderId } from '@/src/utils/app/folders';
import { getFileRootId } from '@/src/utils/app/id';
import {
  getOrganizationPublishPathDepth,
  organizationFolderIdToPublishPathSuffix,
  publishToUrlToOrganizationFolderId,
} from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import { FilesActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';
import { ChatI18nKeys, CommonI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import {
  DialDestinationFolderPopup,
  DialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';

const ORGANIZATION_PUBLISH_ROOT_FOLDER_ID = getFileRootId(PUBLIC_URL_PREFIX);

interface Props {
  isOpen: boolean;
  initiallySelectedFolderId?: string;
  depth?: number;
  onClose: (path: string | false) => void;
}

export const ChangePathDialog = ({
  isOpen,
  initiallySelectedFolderId,
  depth = 0,
  onClose,
}: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);
  const [collapsedTree, setCollapsedTree] = useState(false);

  const resolvedInitialFolderId = useMemo(
    () =>
      publishToUrlToOrganizationFolderId(
        initiallySelectedFolderId ?? PUBLIC_URL_PREFIX,
      ),
    [initiallySelectedFolderId],
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
    handleRenameValidation,
  } = useFileManager({
    initialTab: DialFileManagerTabs.Organization,
    actionLabelsOptions: {
      actionsByTab: {
        my_files: [],
        shared: [],
        organization: [],
        review: [],
      },
    },
    toolbarOptions: {
      tabs: [],
      showHiddenFilesToggle: false,
      isNewButtonDisabled: true,
    },
    availableTabs: new Set([DialFileManagerTabs.Organization]),
  });

  useEffect(() => {
    if (isOpen) {
      setCurrentPath(resolvedInitialFolderId);
    }
  }, [isOpen, resolvedInitialFolderId, setCurrentPath]);

  useEffect(() => {
    if (!lastRenamedParentFolder) return;

    const { oldId, newId } = lastRenamedParentFolder;
    if (!newId || !oldId) return;

    setCurrentPath((prevPath) => {
      if (!prevPath) return prevPath;

      if (prevPath === oldId) return newId;
      if (prevPath.startsWith(`${oldId}/`))
        return updateMovedFolderId(oldId, newId, prevPath);
      return prevPath;
    });

    dispatch(FilesActions.resetLastRenamedParentFolder());
  }, [dispatch, lastRenamedParentFolder, setCurrentPath]);

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

  const handleClose = useCallback(() => {
    onClose(false);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    const folderId = currentPath ?? resolvedInitialFolderId;
    const suffix = organizationFolderIdToPublishPathSuffix(folderId);
    const pathDepth = getOrganizationPublishPathDepth(folderId);

    if (pathDepth + depth > MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH) {
      dispatch(
        UIActions.showErrorToast(t(ChatI18nKeys.NotAllowedMoreNestedFolders)),
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
    }),
    [collapsedTree, treeOptions.header],
  );

  return (
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
      sourceFolder={ORGANIZATION_PUBLISH_ROOT_FOLDER_ID}
      disabledPathTooltip={t(CommonI18nKeys.RootFolderCannotBeSelected)}
      items={fileTreeItems}
      rootItem={rootFolder}
      filesLoading={areFoldersLoading}
      treeOptions={modalTreeOptions}
      gridOptions={{ ...gridOptions }}
      navigationPanelOptions={navigationPanelOptions}
      collapsedFileTree={collapsedTree}
      allowedFileTypes={[]}
      onCreateFolder={handleCreateFolder}
      onMoveToFiles={handleMoveFiles}
      onCreateFolderValidate={handleRenameValidation}
      uploadEnabled={false}
      showHiddenFileSwitcher
    />
  );
};
