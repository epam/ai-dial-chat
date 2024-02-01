import { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getChildAndCurrentFoldersIdsById,
  getPathToFolderById,
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

import {
  MAX_CHAT_AND_PROMPT_FOLDERS_DEPTH,
  PUBLISHING_FOLDER_NAME,
} from '@/src/constants/folders';

import { SelectFolder } from '@/src/components/Common/SelectFolder/SelectFolder';
import { SelectFolderFooter } from '@/src/components/Common/SelectFolder/SelectFolderFooter';
import { SelectFolderHeader } from '@/src/components/Common/SelectFolder/SelectFolderHeader';
import { SelectFolderList } from '@/src/components/Common/SelectFolder/SelectFolderList';

interface Props {
  type: SharingType;
  isOpen: boolean;
  onClose: (path: string | undefined) => void;
  initiallySelectedFolderId: string;
  depth?: number;
}

export const ChangePathDialog = ({
  isOpen,
  onClose,
  type,
  initiallySelectedFolderId,
  depth,
}: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAllFoldersOpened, setIsAllFoldersOpened] = useState(true);
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    '',
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const { selectors, actions } =
    type === SharingType.Conversation || type === SharingType.ConversationFolder
      ? { selectors: ConversationsSelectors, actions: ConversationsActions }
      : { selectors: PromptsSelectors, actions: PromptsActions };

  const newFolderId = useAppSelector(selectors.selectNewAddedFolderId);
  const folders = useAppSelector((state) =>
    selectors.selectTemporaryAndFilteredFolders(state, searchQuery),
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
    [folders, openedFoldersIds],
  );

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      setSelectedFolderId(folderId);
      handleToggleFolder(folderId);
    },
    [handleToggleFolder],
  );

  const handleRenameFolder = useCallback(
    (newName: string, folderId: string) => {
      const error = validateFolderRenaming(folders, newName, folderId, false);

      if (error) {
        setErrorMessage(t(error) as string);
        return;
      }

      dispatch(actions.renameTemporaryFolder({ folderId, name: newName }));
    },
    [actions, dispatch, folders, t],
  );

  const handleAddFolder = useCallback(
    (parentFolderId?: string) => {
      dispatch(
        actions.createTemporaryFolder({
          relativePath: parentFolderId,
        }),
      );

      if (parentFolderId && !openedFoldersIds.includes(parentFolderId)) {
        setOpenedFoldersIds(openedFoldersIds.concat(parentFolderId));
      }
    },
    [actions, dispatch, openedFoldersIds],
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

  const getPath = () => {
    const { path, pathDepth } = getPathToFolderById(folders, selectedFolderId);

    if (pathDepth + (depth ? depth : 0) > MAX_CHAT_AND_PROMPT_FOLDERS_DEPTH) {
      dispatch(
        UIActions.showToast({
          message: t("It's not allowed to have more nested folders"),
          type: 'error',
        }),
      );
      return;
    }

    return onClose(path);
  };

  return (
    <SelectFolder
      isOpen={isOpen}
      modalDataQa="change-path-dialog"
      onClose={() => onClose(undefined)}
      title="Change path"
    >
      <SelectFolderHeader
        handleSearch={handleSearch}
        searchQuery={searchQuery}
        errorMessage={errorMessage}
      >
        <SelectFolderList
          folderProps={{
            searchTerm: searchQuery,
            allFolders: folders,
            isInitialRenameEnabled: true,
            openedFoldersIds,
            onClickFolder: handleFolderSelect,
            onRenameFolder: handleRenameFolder,
            onDeleteFolder: handleDeleteFolder,
            onAddFolder: handleAddFolder,
            newAddedFolderId: newFolderId,
          }}
          handleToggleFolder={handleToggleFolder}
          isAllEntitiesOpened={isAllFoldersOpened}
          initiallySelectedFolderId={initiallySelectedFolderId}
          selectedFolderId={selectedFolderId}
          highlightTemporaryFolders
          rootFolderName={PUBLISHING_FOLDER_NAME}
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        handleNewFolder={() => handleAddFolder()}
        onSelectFolderClick={getPath}
      />
    </SelectFolder>
  );
};
