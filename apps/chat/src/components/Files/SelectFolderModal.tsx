import { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { useHandleFileFolders } from '@/src/hooks/useHandleFileFolders';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { SelectFolder } from '@/src/components/Common/SelectFolder/SelectFolder';
import { SelectFolderFooter } from '@/src/components/Common/SelectFolder/SelectFolderFooter';
import { SelectFolderHeader } from '@/src/components/Common/SelectFolder/SelectFolderHeader';
import { SelectFolderList } from '@/src/components/Common/SelectFolder/SelectFolderList';

interface Props {
  isOpen: boolean;
  selectedFolderName: string | undefined;
  onClose: (path: string | undefined) => void;
}

const loadingStatuses = new Set(['LOADING', undefined]);

export const SelectFolderModal = ({
  isOpen,
  selectedFolderName,
  onClose,
}: Props) => {
  const dispatch = useAppDispatch();

  const [searchQuery, setSearchQuery] = useState('');
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [isAllFilesOpened, setIsAllFilesOpened] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    selectedFolderName,
  );

  const folders = useAppSelector((state) =>
    FilesSelectors.selectFoldersWithSearchTerm(state, searchQuery),
  );
  const newFolderId = useAppSelector(FilesSelectors.selectNewAddedFolderId);
  const foldersStatus = useAppSelector(FilesSelectors.selectFoldersStatus);
  const loadingFolderId = useAppSelector(FilesSelectors.selectLoadingFolderId);

  const {
    handleRenameFolder,
    handleAddFolder,
    handleToggleFolder,
    handleNewFolder,
  } = useHandleFileFolders(
    folders,
    openedFoldersIds,
    setErrorMessage,
    setOpenedFoldersIds,
    setIsAllFilesOpened,
  );
  const showSpinner =
    folders.length === 0 && loadingStatuses.has(foldersStatus);

  useEffect(() => {
    if (isOpen) {
      dispatch(
        FilesActions.getFoldersList({
          paths: [undefined, ...openedFoldersIds],
        }),
      );
    }
  }, [dispatch, isOpen, openedFoldersIds]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      dispatch(FilesActions.resetNewFolderId());
    }
  }, [dispatch, isOpen]);

  const handleSearch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      dispatch(FilesActions.resetNewFolderId());
    },
    [dispatch],
  );

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      setSelectedFolderId(folderId);
      handleToggleFolder(folderId);
    },
    [handleToggleFolder],
  );

  return (
    <SelectFolder
      isOpen={isOpen}
      modalDataQa="select-folder-modal"
      onClose={() => onClose(undefined)}
      title="Select folder"
    >
      <SelectFolderHeader
        handleSearch={handleSearch}
        searchQuery={searchQuery}
        errorMessage={errorMessage}
        showSpinner={showSpinner}
      >
        <SelectFolderList
          folderProps={{
            searchTerm: searchQuery,
            allFolders: folders,
            isInitialRenameEnabled: true,
            openedFoldersIds,
            onClickFolder: handleFolderSelect,
            onRenameFolder: handleRenameFolder,
            onAddFolder: handleAddFolder,
            newAddedFolderId: newFolderId,
            loadingFolderId,
          }}
          handleToggleFolder={handleToggleFolder}
          isAllEntitiesOpened={isAllFilesOpened}
          selectedFolderId={selectedFolderId}
          rootFolderName="All files"
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        handleNewFolder={handleNewFolder}
        onSelectFolderClick={() => onClose(selectedFolderId)}
      />
    </SelectFolder>
  );
};
