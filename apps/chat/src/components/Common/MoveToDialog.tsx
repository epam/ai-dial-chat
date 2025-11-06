import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getChildAndCurrentFoldersIdsById,
  getFolderIdFromEntityId,
  getNextDefaultName,
  updateChildAndCurrentFoldersIds,
  validateFolderRenaming,
} from '@/src/utils/app/folders';
import { getRootId } from '@/src/utils/app/id';
import { constructPath } from '@/src/utils/app/shared-utils';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  FoldersActions,
  PromptsActions,
} from '@/src/store/actions';
import { FoldersSelectors } from '@/src/store/folders/folders.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import {
  CONVERSATIONS_DATE_SECTIONS,
  RECENT_PROMPTS_SECTION_NAME,
} from '@/src/constants/sections';

import { SelectFolder } from './SelectFolder/SelectFolder';
import { SelectFolderFooter } from './SelectFolder/SelectFolderFooter';
import { SelectFolderHeader } from './SelectFolder/SelectFolderHeader';
import { SelectFolderList } from './SelectFolder/SelectFolderList';

import { FolderInterface, ShareEntity } from '@epam/ai-dial-shared';

interface Props {
  entity: ShareEntity;
  featureType: FeatureType;
  onClose: () => void;
  onSelect: (folderId: string) => void;
}

export const MoveToDialog: React.FC<Props> = ({
  entity,
  featureType,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation(Translation.Common);

  const dispatch = useAppDispatch();

  const { selectors, actions } =
    featureType === FeatureType.Chat
      ? { selectors: ConversationsSelectors, actions: ConversationsActions }
      : { selectors: PromptsSelectors, actions: PromptsActions };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    entity.folderId,
  );
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();

  const myFolders = useAppSelector(selectors.selectMyFolders);
  const tempFolders = useAppSelector(FoldersSelectors.selectTemporaryFolders);
  const newAddedTemporaryFolderId = useAppSelector(
    FoldersSelectors.selectNewAddedTemporaryFolderId,
  );

  const rootFolderId = getRootId({ featureType });

  const folders = useMemo(
    () => [...myFolders, ...tempFolders] as FolderInterface[],
    [myFolders, tempFolders],
  );

  const handleToggleFolder = useCallback(
    (folderId?: string) => {
      if (!folderId) {
        setOpenedFoldersIds([]);
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

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

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
        setErrorMessage(t(error) ?? '');
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
    [folders, dispatch, openedFoldersIds, t],
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      dispatch(
        FoldersActions.deleteTemporaryFolder({
          folderId,
        }),
      );
    },
    [dispatch],
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
        FoldersActions.createTemporaryFolder({
          type: featureType,
          folderId: parentFolderId,
          name: folderName,
          id,
        }),
      );

      if (parentFolderId && !openedFoldersIds.includes(parentFolderId)) {
        setOpenedFoldersIds(openedFoldersIds.concat(parentFolderId));
      }
    },
    [dispatch, folders, rootFolderId, openedFoldersIds, t, featureType],
  );

  const clearState = useCallback(() => {
    dispatch(FoldersActions.clearTemporaryFolders());
  }, [dispatch]);

  const handleSelect = useCallback(() => {
    if (selectedFolderId) {
      const selectedTempFolders = tempFolders.filter(
        (folder) =>
          folder.id === selectedFolderId ||
          selectedFolderId.startsWith(`${folder.id}/`),
      );

      dispatch(
        actions.addFolders({
          folders: selectedTempFolders.map(({ temporary: _, ...folder }) => ({
            ...folder,
            type: featureType,
          })),
        }),
      );
    }

    clearState();
    onSelect(selectedFolderId ?? rootFolderId);
  }, [
    actions,
    clearState,
    dispatch,
    featureType,
    onSelect,
    rootFolderId,
    selectedFolderId,
    tempFolders,
  ]);

  const handleClose = useCallback(() => {
    clearState();
    onClose();
  }, [clearState, onClose]);

  return (
    <SelectFolder
      isOpen
      modalDataQa="select-folder-modal"
      onClose={handleClose}
      title={t('Move to')}
    >
      <SelectFolderHeader
        errorMessage={errorMessage}
        onSearch={handleSearch}
        searchQuery={searchQuery}
      >
        <SelectFolderList
          disableSectionToggle
          searchTerm={searchQuery}
          allFolders={folders}
          isInitialRenameEnabled
          openedFoldersIds={openedFoldersIds}
          newAddedFolderId={newAddedTemporaryFolderId}
          onClickFolder={handleFolderSelect}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onAddFolder={handleAddFolder}
          onFolderSelect={handleFolderSelect}
          isAllEntitiesOpened
          initiallySelectedFolderId={entity.folderId}
          selectedFolderId={selectedFolderId}
          rootFolderName={
            featureType === FeatureType.Chat
              ? CONVERSATIONS_DATE_SECTIONS.today
              : RECENT_PROMPTS_SECTION_NAME
          }
          rootFolderId={rootFolderId}
          showAllRootFolders
          onShowError={setErrorMessage}
          canManageOnlyTemporaryFolders
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        onCreateNewFolder={handleAddFolder}
        onSelectFolderClick={handleSelect}
        selectBtnText="Move"
      />
    </SelectFolder>
  );
};
