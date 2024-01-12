import { Dispatch, SetStateAction, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import {
  notAllowedSymbols,
  notAllowedSymbolsRegex,
} from '@/src/utils/app/file';
import { getChildAndCurrentFoldersIdsById } from '@/src/utils/app/folders';

import { FolderInterface } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { useAppDispatch } from '@/src/store/hooks';

/**
 * Custom hook to handle attachment folder operations.
 *
 * @param folders - Array of folders.
 * @param setErrorMessage - Function to set error message.
 * @param openedFoldersIds - Array of opened folders ids.
 * @param setOpenedFoldersIds - Function to set opened folders ids.
 * @param setIsAllFilesOpened - Function to set if all files are opened.
 * @returns Object containing various handlers for folder operations.
 */
export const useHandleFileFolders = (
  folders: FolderInterface[],
  openedFoldersIds: string[],
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
  setOpenedFoldersIds: Dispatch<SetStateAction<string[]>>,
  setIsAllFilesOpened: Dispatch<SetStateAction<boolean>>,
) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  /**
   * Handles renaming of a folder.
   *
   * @param newName - New name for the folder.
   * @param folderId - ID of the folder to be renamed.
   */
  const handleRenameFolder = useCallback(
    (newName: string, folderId: string) => {
      const renamingFolder = folders.find((folder) => folder.id === folderId);
      const folderWithSameName = folders.find(
        (folder) =>
          folder.name === newName.trim() &&
          folderId !== folder.id &&
          folder.folderId === renamingFolder?.folderId,
      );

      if (folderWithSameName) {
        setErrorMessage(
          t('Not allowed to have folders with same names') as string,
        );
        return;
      }

      if (newName.match(notAllowedSymbolsRegex)) {
        setErrorMessage(
          t(
            `The symbols ${notAllowedSymbols} are not allowed in folder name`,
          ) as string,
        );
        return;
      }
      dispatch(FilesActions.renameFolder({ folderId, newName }));
    },
    [dispatch, folders, setErrorMessage, t],
  );

  /**
   * Handles adding a new folder.
   *
   * @param relativePath - The relative path where the new folder will be added.
   */
  const handleAddFolder = useCallback(
    (relativePath: string) => {
      dispatch(FilesActions.addNewFolder({ relativePath }));

      if (!openedFoldersIds.includes(relativePath)) {
        setOpenedFoldersIds(openedFoldersIds.concat(relativePath));
        dispatch(FilesActions.getFolders({ path: relativePath }));
      }
    },
    [dispatch, openedFoldersIds, setOpenedFoldersIds],
  );

  /**
   * Toggles the state of a folder (open/close).
   *
   * @param folderId - ID of the folder to toggle.
   */
  const handleToggleFolder = useCallback(
    (folderId: string | undefined) => {
      if (!folderId) {
        setIsAllFilesOpened((value) => !value);
        setOpenedFoldersIds([]);
        return;
      }

      if (openedFoldersIds.includes(folderId)) {
        const childFolders = getChildAndCurrentFoldersIdsById(
          folderId,
          folders,
        );
        setOpenedFoldersIds(
          openedFoldersIds.filter((id) => !childFolders.includes(id)),
        );
      } else {
        setOpenedFoldersIds(openedFoldersIds.concat(folderId));
        dispatch(FilesActions.getFilesWithFolders({ path: folderId }));
      }
    },
    [
      dispatch,
      folders,
      openedFoldersIds,
      setIsAllFilesOpened,
      setOpenedFoldersIds,
    ],
  );

  /**
   * Handles the creation of a new folder.
   */
  const handleNewFolder = useCallback(() => {
    dispatch(FilesActions.addNewFolder({}));
    setIsAllFilesOpened(true);
  }, [dispatch, setIsAllFilesOpened]);

  return {
    handleRenameFolder,
    handleAddFolder,
    handleToggleFolder,
    handleNewFolder,
  };
};
