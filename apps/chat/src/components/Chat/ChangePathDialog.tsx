import { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { constructPath } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getFolderIdFromEntityId,
  getNextDefaultName,
  getPathToFolderById,
  validateFolderRenaming,
} from '@/src/utils/app/folders';

import { FeatureType } from '@/src/types/common';
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
import { PublicationActions } from '@/src/store/publication/publication.reducers';
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

interface Props {
  type: SharingType;
  isOpen: boolean;
  onClose: (path: string | undefined) => void;
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
  depth,
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

  const folders = useAppSelector((state) =>
    selectors.selectTemporaryAndPublishedFolders(state, searchQuery),
  );
  const loadingFolderIds = useAppSelector(selectors.selectLoadingFolderIds);

  useEffect(() => {
    dispatch(
      PublicationActions.uploadAllPublishedWithMeItems({
        featureType:
          type === SharingType.Conversation ||
          type === SharingType.ConversationFolder
            ? FeatureType.Chat
            : FeatureType.Prompt,
      }),
    );
  }, [dispatch, type]);

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
      const selectedFolder = folders.find((f) => f.id === folderId);

      if (!selectedFolder?.temporary) {
        if (
          type === SharingType.Conversation ||
          type === SharingType.ConversationFolder
        ) {
          dispatch(
            ConversationsActions.uploadConversationsWithFolders({
              ids: [folderId],
            }),
          );
        } else {
          dispatch(
            PromptsActions.uploadChildPromptsWithFolders({ ids: [folderId] }),
          );
        }
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
    [dispatch, folders, openedFoldersIds, type],
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
    (parentFolderId: string) => {
      const folderName = getNextDefaultName(
        t(DEFAULT_FOLDER_NAME),
        folders,
        0,
        false,
        true,
      );

      setSelectedFolderId(
        constructPath(parentFolderId || rootFolderId, folderName),
      );

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

  const getPath = () => {
    const { path, pathDepth } = getPathToFolderById(folders, selectedFolderId);

    if (
      pathDepth + (depth ? depth : 0) >
      MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH
    ) {
      dispatch(
        UIActions.showErrorToast(
          t('chat.common.error.not_allowed_to_have_more_nested_folders'),
        ),
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
      title={t('chat.common.change_path.label')}
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
            featureType:
              type === SharingType.Conversation ||
              type === SharingType.ConversationFolder
                ? FeatureType.Chat
                : FeatureType.Prompt,
            isSidePanelFolder: false,
            loadingFolderIds,
          }}
          handleFolderSelect={handleFolderSelect}
          isAllEntitiesOpened={isAllFoldersOpened}
          initiallySelectedFolderId={initiallySelectedFolderId}
          selectedFolderId={selectedFolderId}
          highlightTemporaryFolders
          rootFolderName={PUBLISHING_FOLDER_NAME}
          rootFolderId={rootFolderId}
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        handleNewFolder={() => handleAddFolder(rootFolderId)}
        onSelectFolderClick={getPath}
      />
    </SelectFolder>
  );
};
