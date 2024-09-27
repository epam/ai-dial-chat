import { Dispatch, SetStateAction, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getChildAndCurrentFoldersIdsById,
  validateFolderRenaming,
} from '@/src/utils/app/folders';
import { getFileRootId } from '@/src/utils/app/id';

import { FolderInterface } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { UploadStatus } from '@epam/ai-dial-shared';

/**
 * Custom hook to handle attachment folder operations.
 *
 * @param folders - Array of folders.
 * @param setErrorMessage - Function to set error message.
 * @param rootFolderId - root id to check for all items opened.
 * @param openedFoldersIds - Array of opened folders ids.
 * @param setOpenedFoldersIds - Function to set opened folders ids.
 * @param setIsAllFilesOpened - Function to set if all files are opened.
 * @returns Object containing various handlers for folder operations.
 */
export const useHandleFileFolders = (
  folders: FolderInterface[],
  openedFoldersIds: string[],
  rootFolderId: string,
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
  setOpenedFoldersIds: Dispatch<SetStateAction<string[]>>,
  setIsAllFilesOpened?: Dispatch<SetStateAction<boolean>>,
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
      const error = validateFolderRenaming(folders, newName, folderId);

      if (error) {
        setErrorMessage(t(error) as string);
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
    (parentId: string) => {
      dispatch(FilesActions.addNewFolder({ parentId }));

      if (!openedFoldersIds.includes(parentId)) {
        setOpenedFoldersIds(openedFoldersIds.concat(parentId));
        dispatch(FilesActions.getFolders({ id: parentId }));
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
    (folderId: string) => {
      if (folderId === rootFolderId) {
        setIsAllFilesOpened?.((value) => !value);
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
        const folder = folders.find((f) => f.id === folderId);
        if (folder?.status !== UploadStatus.LOADED) {
          dispatch(FilesActions.getFilesWithFolders({ id: folderId }));
        }
      }
    },
    [
      dispatch,
      folders,
      openedFoldersIds,
      rootFolderId,
      setIsAllFilesOpened,
      setOpenedFoldersIds,
    ],
  );

  /**
   * Handles the creation of a new folder.
   */
  const handleNewFolder = useCallback(() => {
    dispatch(FilesActions.addNewFolder({ parentId: getFileRootId() }));
    setIsAllFilesOpened?.(true);
  }, [dispatch, setIsAllFilesOpened]);

  return {
    handleRenameFolder,
    handleAddFolder,
    handleToggleFolder,
    handleNewFolder,
  };
};
