import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { useTranslation } from '@/src/hooks/useTranslation';

import { updateMovedFolderId } from '@/src/utils/app/folders';
import {
  getOrganizationPublishPathDepth,
  organizationFolderIdToPublishPathSuffix,
  publishToUrlToOrganizationFolderId,
  remapPublicFolderToFilesNamespace,
} from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import { FilesActions, FoldersActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ConversationsSelectors,
  FilesSelectors,
  PromptsSelectors,
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
  DialDestinationFolderPopup,
  DialFileManagerTabs,
  DialUploadFileItem,
} from '@epam/ai-dial-ui-kit';
import uniqBy from 'lodash-es/uniqBy';

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
  const addedTempFolderIdsRef = useRef<Set<string>>(new Set());
  const filesFolders = useAppSelector(FilesSelectors.selectFolders);
  const filesFoldersRef = useRef(filesFolders);
  filesFoldersRef.current = filesFolders;

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

  const conversationPublicFolders = useAppSelector(
    ConversationsSelectors.selectPublicFolders,
  );
  const promptPublicFolders = useAppSelector(
    PromptsSelectors.selectPublicFolders,
  );
  const applicationPublicFolders = useAppSelector(
    ApplicationSelectors.selectPublicFolders,
  );

  const additionalOrganizationFolders = useMemo(
    () =>
      uniqBy(
        [
          ...conversationPublicFolders,
          ...promptPublicFolders,
          ...applicationPublicFolders,
        ].map(remapPublicFolderToFilesNamespace),
        'id',
      ),
    [conversationPublicFolders, promptPublicFolders, applicationPublicFolders],
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
    additionalFilesAndFolders: {
      files: [],
      folders: additionalOrganizationFolders,
    },
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
      dispatch(FoldersActions.clearTemporaryFolders());

      const idsToRemove = addedTempFolderIdsRef.current;
      if (idsToRemove.size) {
        const cleaned = filesFoldersRef.current.filter(
          (f) => !idsToRemove.has(f.id),
        );
        dispatch(FilesActions.setFolders({ folders: cleaned }));
        addedTempFolderIdsRef.current = new Set();
      }
    }
  }, [dispatch, isOpen]);

  const handleCreateOrganizationFolder = useCallback(
    (_file: DialUploadFileItem, folderPath: string) => {
      const segments = folderPath.split('/');
      const name = segments[segments.length - 1];
      if (!name) return;

      const parentFolderId = segments.slice(0, -1).join('/');

      addedTempFolderIdsRef.current.add(folderPath);

      dispatch(
        FilesActions.addFolders({
          folders: [
            {
              id: folderPath,
              folderId: parentFolderId,
              name,
              type: FeatureType.File,
              status: UploadStatus.LOADED,
              temporary: true,
              publishedWithMe: true,
              permissions: [SharePermission.READ, SharePermission.WRITE],
            },
          ],
        }),
      );
    },
    [dispatch],
  );

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
      items={fileTreeItems}
      rootItem={rootFolder}
      filesLoading={areFoldersLoading}
      treeOptions={modalTreeOptions}
      gridOptions={{ ...gridOptions }}
      navigationPanelOptions={navigationPanelOptions}
      collapsedFileTree={collapsedTree}
      allowedFileTypes={[]}
      onCreateFolder={handleCreateOrganizationFolder}
      onMoveToFiles={handleMoveFiles}
      onCreateFolderValidate={handleRenameValidation}
      uploadEnabled={false}
      showHiddenFileSwitcher
    />
  );
};
