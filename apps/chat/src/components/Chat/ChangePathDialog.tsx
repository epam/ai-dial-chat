import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { constructPath } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getFolderIdFromEntityId,
  getNextDefaultName,
  getPathToFolderById,
  sortByName,
  validateFolderRenaming,
} from '@/src/utils/app/folders';

import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import {
  MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH,
  PUBLISHING_FOLDER_NAME,
} from '@/src/constants/folders';

import { SelectFolder } from '@/src/components/Common/SelectFolder/SelectFolder';
import { SelectFolderFooter } from '@/src/components/Common/SelectFolder/SelectFolderFooter';
import { SelectFolderHeader } from '@/src/components/Common/SelectFolder/SelectFolderHeader';
import { SelectFolderList } from '@/src/components/Common/SelectFolder/SelectFolderList';

import { FolderProps } from '../Folder/Folder';

import { ShareEntity } from '@epam/ai-dial-shared';

interface Props {
  type: SharingType;
  isOpen: boolean;
  onClose: (path?: string) => void;
  initiallySelectedFolderId: string;
  rootFolderId: string;
  depth?: number;
}

export const ChangePathDialog = ({
  isOpen,
  onClose,
  type,
  initiallySelectedFolderId,
  rootFolderId,
  depth = 0,
}: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAllFoldersOpened, setIsAllFoldersOpened] = useState(true);
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    rootFolderId,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const { selectors, actions } =
    type === SharingType.Conversation || type === SharingType.ConversationFolder
      ? { selectors: ConversationsSelectors, actions: ConversationsActions }
      : { selectors: PromptsSelectors, actions: PromptsActions };

  const newFolderId = useAppSelector(selectors.selectNewAddedFolderId);

  const conversationFolders = useAppSelector((state) =>
    ConversationsSelectors.selectTemporaryAndPublishedFolders(
      state,
      searchQuery,
    ),
  );
  const promptFolders = useAppSelector((state) =>
    PromptsSelectors.selectTemporaryAndPublishedFolders(state, searchQuery),
  );
  const loadingFolderIds = useAppSelector(selectors.selectLoadingFolderIds);

  const folders = useMemo(
    () => sortByName([...conversationFolders, ...promptFolders]),
    [conversationFolders, promptFolders],
  );

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      dispatch(actions.resetNewFolderId());
    }
  }, [actions, dispatch, isOpen]);

  const handleSearch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      dispatch(actions.resetNewFolderId());
    },
    [actions, dispatch],
  );

  const handleToggleFolder = useCallback(
    (folderId?: string) => {
      if (!folderId) {
        setIsAllFoldersOpened((value) => !value);
        setOpenedFoldersIds([]);
        setSelectedFolderId(folderId);

        return;
      }

      dispatch(actions.uploadFoldersIfNotLoaded({ ids: [folderId] }));

      if (openedFoldersIds.includes(folderId)) {
        const childFoldersIds = getChildAndCurrentFoldersIdsById(
          folderId,
          folders,
        );
        setOpenedFoldersIds(
          openedFoldersIds.filter((id) => !childFoldersIds.includes(id)),
        );
      } else {
        setOpenedFoldersIds(openedFoldersIds.concat(folderId));
      }
    },
    [actions, dispatch, folders, openedFoldersIds],
  );

  const handleFolderSelect = useCallback(
    (folderId?: string | undefined) => {
      setSelectedFolderId(folderId);
      handleToggleFolder(folderId);
    },
    [handleToggleFolder],
  );

  const handleRenameFolder = useCallback(
    (newName: string, folderId: string) => {
      const error = validateFolderRenaming(folders, newName, folderId, false);
      const newFolderId = constructPath(
        getFolderIdFromEntityId(folderId),
        newName,
      );
      const mappedFolderIds = folders.map(({ id }) => id);

      if (mappedFolderIds.some((id) => id === newFolderId)) {
        return;
      }

      setSelectedFolderId(
        constructPath(getFolderIdFromEntityId(folderId), newName),
      );

      if (error) {
        setErrorMessage(t(error) as string);
        return;
      }

      dispatch(actions.renameTemporaryFolder({ folderId, name: newName }));
    },
    [actions, dispatch, folders, t],
  );

  const handleAddFolder = useCallback(
    (parentFolderId = rootFolderId) => {
      const folderName = getNextDefaultName(
        t(DEFAULT_FOLDER_NAME),
        folders,
        0,
        false,
        true,
      );

      setSelectedFolderId(constructPath(parentFolderId, folderName));

      dispatch(
        actions.createTemporaryFolder({
          relativePath: parentFolderId,
        }),
      );

      if (parentFolderId && !openedFoldersIds.includes(parentFolderId)) {
        setOpenedFoldersIds(openedFoldersIds.concat(parentFolderId));
      }
    },
    [actions, dispatch, folders, rootFolderId, openedFoldersIds, t],
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) =>
      dispatch(
        actions.deleteTemporaryFolder({
          folderId,
        }),
      ),
    [actions, dispatch],
  );

  const folderProps: Omit<
    FolderProps<ShareEntity, unknown>,
    'currentFolder' | 'featureType'
  > = useMemo(
    () => ({
      searchTerm: searchQuery,
      allFolders: folders,
      isInitialRenameEnabled: true,
      openedFoldersIds,
      newAddedFolderId: newFolderId,
      loadingFolderIds,
      additionalItemData: {
        isChangePathFolder: true,
      },
      onClickFolder: handleFolderSelect,
      onRenameFolder: handleRenameFolder,
      onDeleteFolder: handleDeleteFolder,
      onAddFolder: handleAddFolder,
    }),
    [
      folders,
      handleAddFolder,
      handleDeleteFolder,
      handleFolderSelect,
      handleRenameFolder,
      loadingFolderIds,
      newFolderId,
      openedFoldersIds,
      searchQuery,
    ],
  );

  const getPath = useCallback(() => {
    const { path, pathDepth } = getPathToFolderById(folders, selectedFolderId);

    if (pathDepth + depth > MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH) {
      dispatch(
        UIActions.showErrorToast(
          t("It's not allowed to have more nested folders"),
        ),
      );
      return;
    }

    return onClose(path);
  }, [depth, dispatch, folders, onClose, selectedFolderId, t]);

  return (
    <SelectFolder
      isOpen={isOpen}
      modalDataQa="select-folder-modal"
      onClose={onClose}
      title={t('Change path')}
    >
      <SelectFolderHeader
        handleSearch={handleSearch}
        searchQuery={searchQuery}
        errorMessage={errorMessage}
      >
        <SelectFolderList
          folderProps={folderProps}
          handleFolderSelect={handleFolderSelect}
          isAllEntitiesOpened={isAllFoldersOpened}
          initiallySelectedFolderId={initiallySelectedFolderId}
          selectedFolderId={selectedFolderId}
          highlightTemporaryFolders
          rootFolderName={PUBLISHING_FOLDER_NAME}
          rootFolderId={rootFolderId}
          showAllRootFolders
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        handleNewFolder={handleAddFolder}
        onSelectFolderClick={getPath}
      />
    </SelectFolder>
  );
};
