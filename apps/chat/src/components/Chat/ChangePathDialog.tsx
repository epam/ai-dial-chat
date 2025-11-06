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

import { FoldersActions, UIActions } from '@/src/store/actions';
import { FoldersSelectors } from '@/src/store/folders/folders.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ConversationsSelectors,
  FilesSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import {
  MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH,
  TEMPORARY_FOLDER_ROOT_ID,
} from '@/src/constants/folders';
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
    TEMPORARY_FOLDER_ROOT_ID,
  );
  const [errorMessage, setErrorMessage] = useState<string>();

  const conversationFolders = useAppSelector(
    ConversationsSelectors.selectPublicFolders,
  );
  const promptFolders = useAppSelector(PromptsSelectors.selectPublicFolders);
  const applicationFolders = useAppSelector(
    ApplicationSelectors.selectPublicFolders,
  );
  const fileFolders = useAppSelector(FilesSelectors.selectPublicFolders);
  const temporaryFolders = useAppSelector(
    FoldersSelectors.selectTemporaryFolders,
  );
  const newAddedTemporaryFolderId = useAppSelector(
    FoldersSelectors.selectNewAddedTemporaryFolderId,
  );

  const allFolders = useMemo(() => {
    const filteredFolders = uniqBy(
      [
        ...conversationFolders,
        ...promptFolders,
        ...applicationFolders,
        ...fileFolders,
        ...temporaryFolders,
      ],
      ({ id }) => getIdWithoutFeatureType(id),
    )
      .filter((folder) => areHiddenFoldersVisible || !isHiddenEntity(folder))
      .map((folder) => ({
        ...folder,
        // Mark root path segments as temporary to avoid featureType binding
        id: constructPath(
          TEMPORARY_FOLDER_ROOT_ID,
          getIdWithoutRootPathSegments(folder.id),
        ),
        folderId: constructPath(
          TEMPORARY_FOLDER_ROOT_ID,
          getIdWithoutRootPathSegments(folder.folderId),
        ),
      }));

    return sortByName(filteredFolders) as FolderInterface[];
  }, [
    conversationFolders,
    promptFolders,
    applicationFolders,
    fileFolders,
    temporaryFolders,
    areHiddenFoldersVisible,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setErrorMessage(undefined);
      dispatch(FoldersActions.resetNewTemporaryFolderId());
    }
  }, [dispatch, isOpen]);

  const handleSearch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      dispatch(FoldersActions.resetNewTemporaryFolderId());
    },
    [dispatch],
  );

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
          allFolders,
        );
        setOpenedFoldersIds(
          openedFoldersIds.filter((id) => !childFoldersIds.includes(id)),
        );
      } else {
        setOpenedFoldersIds(openedFoldersIds.concat(folderId));
      }
    },
    [allFolders, openedFoldersIds],
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
      const error = validateFolderRenaming(
        allFolders,
        newName,
        folderId,
        false,
      );
      const newFolderId = constructPath(
        getFolderIdFromEntityId(folderId),
        newName,
      );
      const mappedFolderIds = allFolders.map(({ id }) => id);

      if (mappedFolderIds.some((id) => id === newFolderId)) {
        return;
      }

      setSelectedFolderId(newFolderId);

      if (error) {
        setErrorMessage(t(error));
        return;
      }

      dispatch(
        FoldersActions.renameTemporaryFolder({ folderId, name: newName }),
      );
      setOpenedFoldersIds(
        updateChildAndCurrentFoldersIds(
          openedFoldersIds,
          folderId,
          newFolderId,
        ),
      );
    },
    [allFolders, dispatch, openedFoldersIds, t],
  );

  const handleAddFolder = useCallback(
    (parentFolderId = TEMPORARY_FOLDER_ROOT_ID) => {
      const folderName = getNextDefaultName(
        t(DEFAULT_FOLDER_NAME),
        allFolders.filter((f) => f.folderId === parentFolderId),
        0,
        false,
        true,
      );
      const id = constructPath(parentFolderId, folderName);

      setSelectedFolderId(id);

      dispatch(
        FoldersActions.createTemporaryFolder({
          folderId: parentFolderId,
          name: folderName,
          id,
        }),
      );

      if (parentFolderId && !openedFoldersIds.includes(parentFolderId)) {
        setOpenedFoldersIds(openedFoldersIds.concat(parentFolderId));
      }
    },
    [dispatch, allFolders, openedFoldersIds, t],
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) =>
      dispatch(
        FoldersActions.deleteTemporaryFolder({
          folderId,
        }),
      ),
    [dispatch],
  );

  const getPath = useCallback(() => {
    const { path, pathDepth } = getPathToFolderById(
      allFolders,
      selectedFolderId,
    );

    if (pathDepth + depth > MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH) {
      dispatch(
        UIActions.showErrorToast(
          t("It's not allowed to have more nested folders"),
        ),
      );
      return;
    }

    return onClose(path);
  }, [depth, dispatch, allFolders, onClose, selectedFolderId, t]);

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
          allFolders={allFolders}
          isInitialRenameEnabled
          openedFoldersIds={openedFoldersIds}
          newAddedFolderId={newAddedTemporaryFolderId}
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
          rootFolderId={TEMPORARY_FOLDER_ROOT_ID}
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
