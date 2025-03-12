import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useHandleFileFolders } from '@/src/hooks/useHandleFileFolders';

import {
  getParentFolderIdsFromFolderId,
  splitEntityId,
} from '@/src/utils/app/folders';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { SelectFolder } from '@/src/components/Common/SelectFolder/SelectFolder';
import { SelectFolderFooter } from '@/src/components/Common/SelectFolder/SelectFolderFooter';
import { SelectFolderHeader } from '@/src/components/Common/SelectFolder/SelectFolderHeader';
import { SelectFolderList } from '@/src/components/Common/SelectFolder/SelectFolderList';

import uniq from 'lodash-es/uniq';

interface Props {
  isOpen: boolean;
  initialSelectedFolderId?: string;
  rootFolderId: string;
  onClose: (path: string | undefined) => void;
  disallowSelectRootFolder?: boolean;
}

export const SelectFolderModal = ({
  isOpen,
  initialSelectedFolderId,
  rootFolderId,
  onClose,
  disallowSelectRootFolder,
}: Props) => {
  const dispatch = useAppDispatch();

  const { name: rootFolderName } = splitEntityId(rootFolderId);

  const defaultSelectedFolder = useMemo(() => {
    return (
      initialSelectedFolderId ??
      (!disallowSelectRootFolder ? rootFolderId : undefined)
    );
  }, [disallowSelectRootFolder, initialSelectedFolderId, rootFolderId]);

  const defaultOpenedFoldersIds = useMemo(() => {
    return initialSelectedFolderId
      ? getParentFolderIdsFromFolderId(initialSelectedFolderId)
      : [];
  }, [initialSelectedFolderId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>(
    defaultOpenedFoldersIds,
  );
  const [isAllFilesOpened, setIsAllFilesOpened] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    defaultSelectedFolder,
  );

  const folders = useAppSelector((state) =>
    FilesSelectors.selectFoldersWithSearchTerm(state, searchQuery),
  );
  const newFolderId = useAppSelector(FilesSelectors.selectNewAddedFolderId);
  const areFoldersLoading = useAppSelector(
    FilesSelectors.selectAreFoldersLoading,
  );
  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );

  const {
    handleRenameFolder,
    handleAddFolder,
    handleToggleFolder,
    handleNewFolder,
  } = useHandleFileFolders(
    folders,
    openedFoldersIds,
    rootFolderId,
    setErrorMessage,
    setOpenedFoldersIds,
    setIsAllFilesOpened,
  );
  const showSpinner = folders.length === 0 && areFoldersLoading;

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
      if (!disallowSelectRootFolder || folderId !== rootFolderId) {
        setSelectedFolderId(folderId);
      }
      handleToggleFolder(folderId);
    },
    [disallowSelectRootFolder, handleToggleFolder, rootFolderId],
  );

  const handleClose = useCallback(
    (folderId: string | undefined) => {
      onClose(folderId);
      setErrorMessage(undefined);
    },
    [onClose],
  );

  const handleSelectFolder = useCallback(
    () => handleClose(selectedFolderId),
    [handleClose, selectedFolderId],
  );

  const onCancel = useCallback(() => {
    handleClose(undefined);
    setSelectedFolderId(defaultSelectedFolder);
    setOpenedFoldersIds((prev) => uniq(prev.concat(defaultOpenedFoldersIds)));
  }, [defaultOpenedFoldersIds, defaultSelectedFolder, handleClose]);

  return (
    <SelectFolder
      isOpen={isOpen}
      modalDataQa="select-folder-modal"
      onClose={onCancel}
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
            loadingFolderIds: loadingFolderIds,
          }}
          handleFolderSelect={handleFolderSelect}
          isAllEntitiesOpened={isAllFilesOpened}
          selectedFolderId={selectedFolderId}
          rootFolderName={rootFolderName}
          rootFolderId={rootFolderId}
          onShowError={setErrorMessage}
        />
      </SelectFolderHeader>
      <SelectFolderFooter
        handleNewFolder={handleNewFolder}
        onSelectFolderClick={handleSelectFolder}
        disableSelect={!selectedFolderId}
      />
    </SelectFolder>
  );
};
