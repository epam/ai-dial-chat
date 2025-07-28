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
import {
  getIdWithoutFeatureType,
  getIdWithoutRootPathSegments,
} from '@/src/utils/app/id';
import { isHiddenEntity } from '@/src/utils/app/search';

import { Translation } from '@/src/types/translation';

import { PublicationActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ConversationsSelectors,
  FilesSelectors,
  PromptsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';
import { TEMPORARY_PUBLICATION_FOLDER_ID } from '@/src/constants/publication';
import { ORGANIZATION_SECTION_NAME } from '@/src/constants/sections';

import { SelectFolder } from '@/src/components/Common/SelectFolder/SelectFolder';
import { SelectFolderFooter } from '@/src/components/Common/SelectFolder/SelectFolderFooter';
import { SelectFolderHeader } from '@/src/components/Common/SelectFolder/SelectFolderHeader';
import { SelectFolderList } from '@/src/components/Common/SelectFolder/SelectFolderList';

import { FolderInterface } from '@epam/ai-dial-shared';
import uniqBy from 'lodash-es/uniqBy';

interface Props {
  isOpen: boolean;
  initiallySelectedFolderId: string;
  depth?: number;
  onClose: (path?: string) => void;
}

const additionalItemData = {
  isChangePathFolder: true,
};

export const ChangePathDialog = ({
  isOpen,
  initiallySelectedFolderId,
  depth = 0,
  onClose,
}: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAllFoldersOpened, setIsAllFoldersOpened] = useState(true);
  const [areHiddenFoldersVisible, setAreHiddenFoldersVisible] = useState(false);
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    TEMPORARY_PUBLICATION_FOLDER_ID,
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  const [newFolderId, setNewFolderId] = useState<string>();

  const conversationFolders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredPublicFolders(state, searchQuery),
  );
  const promptFolders = useAppSelector((state) =>
    PromptsSelectors.selectFilteredPublicFolders(state, searchQuery),
  );
  const applicationFolders = useAppSelector((state) =>
    ApplicationSelectors.selectFilteredPublicFolders(state, searchQuery),
  );
  const fileFolders = useAppSelector((state) =>
    FilesSelectors.selectFilteredPublicFolders(state, searchQuery),
  );
  const publicationFolders = useAppSelector((state) =>
    PublicationSelectors.selectTemporaryPublishFoldersWithSearchTerm(
      state,
      searchQuery,
    ),
  );

  const folders = useMemo(() => {
    const filteredFolders = uniqBy(
      [
        ...conversationFolders,
        ...promptFolders,
        ...applicationFolders,
        ...fileFolders,
        ...publicationFolders,
      ],
      ({ id }) => getIdWithoutFeatureType(id),
    )
      .filter((folder) => areHiddenFoldersVisible || !isHiddenEntity(folder))
      .map((folder) => ({
        ...folder,
        id: constructPath(
          TEMPORARY_PUBLICATION_FOLDER_ID,
          getIdWithoutRootPathSegments(folder.id),
        ),
        folderId: constructPath(
          TEMPORARY_PUBLICATION_FOLDER_ID,
          getIdWithoutRootPathSegments(folder.folderId),
        ),
      }));

    return sortByName(filteredFolders) as FolderInterface[];
  }, [
    conversationFolders,
    promptFolders,
    applicationFolders,
    fileFolders,
    publicationFolders,
    areHiddenFoldersVisible,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setErrorMessage(undefined);
      setNewFolderId(undefined);
    }
  }, [isOpen]);

  const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setNewFolderId(undefined);
  }, []);

  const handleToggleHiddenFolders = useCallback(() => {
    setAreHiddenFoldersVisible((prev) => !prev);
  }, []);

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

      dispatch(
        PublicationActions.renameTemporaryFolder({ folderId, name: newName }),
      );
      setOpenedFoldersIds(
        updateChildAndCurrentFoldersIds(
          openedFoldersIds,
          folderId,
          newFolderId,
        ),
      );
    },
    [folders, dispatch, openedFoldersIds, t],
  );

  const handleAddFolder = useCallback(
    (parentFolderId = TEMPORARY_PUBLICATION_FOLDER_ID) => {
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
        PublicationActions.createTemporaryFolder({
          folderId: parentFolderId,
          name: folderName,
          id,
        }),
      );
      setNewFolderId(
        constructPath(
          TEMPORARY_PUBLICATION_FOLDER_ID,
          getIdWithoutRootPathSegments(id),
        ),
      );

      if (parentFolderId && !openedFoldersIds.includes(parentFolderId)) {
        setOpenedFoldersIds(openedFoldersIds.concat(parentFolderId));
      }
    },
    [dispatch, folders, openedFoldersIds, t],
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) =>
      dispatch(
        PublicationActions.deleteTemporaryFolder({
          folderId,
        }),
      ),
    [dispatch],
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
          loadingFolderIds={[]}
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
          rootFolderId={TEMPORARY_PUBLICATION_FOLDER_ID}
          showAllRootFolders
          onShowError={setErrorMessage}
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        onCreateNewFolder={handleAddFolder}
        onSelectFolderClick={getPath}
        onToggleHiddenFolders={handleToggleHiddenFolders}
        areHiddenFoldersVisible={areHiddenFoldersVisible}
      />
    </SelectFolder>
  );
};
