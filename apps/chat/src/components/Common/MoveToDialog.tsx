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
import { defaultMyItemsFilters } from '@/src/utils/app/search';
import { constructPath } from '@/src/utils/app/shared-utils';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ConversationsActions, PromptsActions } from '@/src/store/actions';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.selectors';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import {
  CONVERSATIONS_DATE_SECTIONS,
  RECENT_PROMPTS_SECTION_NAME,
} from '@/src/constants/sections';

import { FolderProps } from '@/src/components/Folder/Folder';

import { SelectFolder } from './SelectFolder/SelectFolder';
import { SelectFolderFooter } from './SelectFolder/SelectFolderFooter';
import { SelectFolderHeader } from './SelectFolder/SelectFolderHeader';
import { SelectFolderList } from './SelectFolder/SelectFolderList';

import { ShareEntity } from '@epam/ai-dial-shared';

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

  const filteredFoldersSelector = useMemo(
    () => selectors.selectFilteredFolders(defaultMyItemsFilters, '', true),
    [],
  );

  const myFolders = useAppSelector(filteredFoldersSelector);
  const tempFolders = useAppSelector(selectors.selectTemporaryFolders);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    entity.folderId,
  );
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();

  const rootFolderId = getRootId({ featureType });
  const folders = [...myFolders, ...tempFolders];

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

      dispatch(actions.renameTemporaryFolder({ folderId, name: newName }));
      setOpenedFoldersIds(
        updateChildAndCurrentFoldersIds(
          openedFoldersIds,
          folderId,
          newFolderId,
        ),
      );
    },
    [folders, dispatch, actions, openedFoldersIds, t],
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      dispatch(
        actions.deleteTemporaryFolder({
          folderId,
        }),
      );
    },
    [actions, dispatch],
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

  const handleSelect = useCallback(() => {
    onSelect(selectedFolderId ?? rootFolderId);
  }, [onSelect, rootFolderId, selectedFolderId]);

  const folderProps: Omit<
    FolderProps<ShareEntity, unknown>,
    'currentFolder' | 'featureType'
  > = useMemo(
    () => ({
      searchTerm: searchQuery,
      allFolders: folders,
      isInitialRenameEnabled: true,
      openedFoldersIds,
      //   newAddedFolderId: newFolderId,
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
      openedFoldersIds,
      searchQuery,
    ],
  );

  return (
    <SelectFolder
      isOpen
      modalDataQa="select-folder-modal"
      onClose={onClose}
      title={t('Move to')}
    >
      <SelectFolderHeader
        errorMessage={errorMessage}
        handleSearch={handleSearch}
        searchQuery={searchQuery}
      >
        <SelectFolderList
          folderProps={folderProps}
          handleFolderSelect={handleFolderSelect}
          isAllEntitiesOpened
          initiallySelectedFolderId={entity.folderId}
          selectedFolderId={selectedFolderId}
          highlightTemporaryFolders
          rootFolderName={
            featureType === FeatureType.Chat
              ? CONVERSATIONS_DATE_SECTIONS.today
              : RECENT_PROMPTS_SECTION_NAME
          }
          rootFolderId={rootFolderId}
          showAllRootFolders
          onShowError={setErrorMessage}
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        handleNewFolder={handleAddFolder}
        onSelectFolderClick={handleSelect}
      />
    </SelectFolder>
  );
};
