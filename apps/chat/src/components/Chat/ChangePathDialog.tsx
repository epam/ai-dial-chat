import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { constructPath } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getFolderIdFromEntityId,
  getNextDefaultName,
  getPathToFolderById,
  sortByName,
  updateChildAndCurrentFoldersIds,
  validateFolderRenaming,
} from '@/src/utils/app/folders';
import { getIdWithoutFeatureType } from '@/src/utils/app/id';

import { FolderInterface } from '@/src/types/folder';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  PromptsActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ConversationsSelectors,
  FilesSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';
import { ORGANIZATION_SECTION_NAME } from '@/src/constants/sections';

import { SelectFolder } from '@/src/components/Common/SelectFolder/SelectFolder';
import { SelectFolderFooter } from '@/src/components/Common/SelectFolder/SelectFolderFooter';
import { SelectFolderHeader } from '@/src/components/Common/SelectFolder/SelectFolderHeader';
import { SelectFolderList } from '@/src/components/Common/SelectFolder/SelectFolderList';

import uniqBy from 'lodash-es/uniqBy';

interface Props {
  type: SharingType;
  isOpen: boolean;
  onClose: (path?: string) => void;
  initiallySelectedFolderId: string;
  rootFolderId: string;
  depth?: number;
}

const additionalItemData = {
  isChangePathFolder: true,
};

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
  const applicationFolders = useAppSelector(
    ApplicationSelectors.selectPublicFolders,
  );
  const fileFolders = useAppSelector(FilesSelectors.selectPublicFolders);
  const loadingFolderIds = useAppSelector(selectors.selectLoadingFolderIds);

  const folders = useMemo(
    () =>
      sortByName(
        uniqBy(
          [
            ...conversationFolders,
            ...promptFolders,
            ...applicationFolders,
            ...fileFolders,
          ],
          ({ id }) => getIdWithoutFeatureType(id),
        ) as FolderInterface[],
      ),
    [conversationFolders, promptFolders, applicationFolders, fileFolders],
  );

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setErrorMessage(undefined);
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

      setSelectedFolderId(newFolderId);

      if (error) {
        setErrorMessage(t(error));
        return;
      }

      dispatch(actions.renameTemporaryFolder({ folderId, name: newName }));
      setOpenedFoldersIds(
        updateChildAndCurrentFoldersIds(
          openedFoldersIds,
          folderId,
          newFolderId,
        ),
      );
    },
    [actions, dispatch, folders, t, openedFoldersIds, setOpenedFoldersIds],
  );

  const handleAddFolder = useCallback(
    (parentFolderId = rootFolderId) => {
      const folderName = getNextDefaultName(
        t(DEFAULT_FOLDER_NAME),
        folders.filter((f) => f.folderId === parentFolderId),
        0,
        false,
        true,
      );
      const id = constructPath(parentFolderId, folderName);

      setSelectedFolderId(id);

      dispatch(
        actions.createTemporaryFolder({
          folderId: parentFolderId,
          name: folderName,
          id,
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
        onSearch={handleSearch}
        searchQuery={searchQuery}
        errorMessage={errorMessage}
      >
        <SelectFolderList
          searchTerm={searchQuery}
          allFolders={folders}
          isInitialRenameEnabled
          openedFoldersIds={openedFoldersIds}
          newAddedFolderId={newFolderId}
          loadingFolderIds={loadingFolderIds}
          additionalItemData={additionalItemData}
          onClickFolder={handleFolderSelect}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onAddFolder={handleAddFolder}
          onFolderSelect={handleFolderSelect}
          isAllEntitiesOpened={isAllFoldersOpened}
          initiallySelectedFolderId={initiallySelectedFolderId}
          selectedFolderId={selectedFolderId}
          highlightTemporaryFolders
          rootFolderName={ORGANIZATION_SECTION_NAME}
          rootFolderId={rootFolderId}
          showAllRootFolders
          onShowError={setErrorMessage}
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        onCreateNewFolder={handleAddFolder}
        onSelectFolderClick={getPath}
      />
    </SelectFolder>
  );
};
