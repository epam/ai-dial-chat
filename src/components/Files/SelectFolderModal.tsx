import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useId,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { IconX } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getChildAndCurrentFoldersIdsById } from '@/src/utils/app/folders';

import { HighlightColor } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';
import Folder from '@/src/components/Folder/Folder';

import FolderPlus from '../../../public/images/icons/folder-plus.svg';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Spinner } from '../Common/Spinner';

interface Props {
  isOpen: boolean;
  selectedFolderName: string | undefined;
  onClose: (path: string | undefined | boolean) => void;
}

const loadingStatuses = new Set(['LOADING', undefined]);

export const SelectFolderModal = ({
  isOpen,
  selectedFolderName,
  onClose,
}: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: onClose,
  });
  const role = useRole(context);
  const dismiss = useDismiss(context, { outsidePressEvent: 'mousedown' });
  const { getFloatingProps } = useInteractions([role, dismiss]);
  const headingId = useId();

  const folders = useAppSelector(FilesSelectors.selectFolders);
  const newFolderId = useAppSelector(FilesSelectors.selectNewAddedFolderId);
  const [searchQuery, setSearchQuery] = useState('');
  const filteredFolders = useMemo(() => {
    return folders.filter(({ name }) =>
      name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [folders, searchQuery]);
  const foldersStatus = useAppSelector(FilesSelectors.selectFoldersStatus);
  const loadingFolderId = useAppSelector(FilesSelectors.selectLoadingFolderId);
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [isAllFilesOpened, setIsAllFilesOpened] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    selectedFolderName,
  );
  const highlightedFolders = useMemo(() => {
    return [selectedFolderId].filter(Boolean) as string[];
  }, [selectedFolderId]);
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

  const handleSearch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value),
    [],
  );

  const handleNewFolder = useCallback(() => {
    dispatch(FilesActions.addNewFolder({}));
    setIsAllFilesOpened(true);
  }, [dispatch]);

  const handleToggleFolder = useCallback(
    (folderId: string | undefined) => {
      if (!folderId) {
        setIsAllFilesOpened((value) => !value);
        setOpenedFoldersIds([]);
        setSelectedFolderId(folderId);
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
        dispatch(FilesActions.getFolders({ path: folderId }));
      }
    },
    [dispatch, folders, openedFoldersIds],
  );

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      setSelectedFolderId(folderId);

      handleToggleFolder(folderId);
    },
    [handleToggleFolder],
  );

  const handleAddFolder = useCallback(
    (parentFolderId: string) => {
      dispatch(FilesActions.addNewFolder({ relativePath: parentFolderId }));

      if (!openedFoldersIds.includes(parentFolderId)) {
        setOpenedFoldersIds(openedFoldersIds.concat(parentFolderId));
        dispatch(FilesActions.getFolders({ path: parentFolderId }));
      }
    },
    [dispatch, openedFoldersIds],
  );
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
          t(`Not allowed to have folders with same names`) as string,
        );
        return;
      }
      dispatch(FilesActions.renameFolder({ folderId, newName }));
    },
    [dispatch, folders, t],
  );

  return (
    <FloatingPortal id="theme-main">
      {isOpen && (
        <FloatingOverlay
          lockScroll
          className="z-50 flex items-center justify-center bg-gray-900/70 p-3 dark:bg-gray-900/30"
        >
          <FloatingFocusManager context={context}>
            <div
              className="relative flex max-h-full min-w-full flex-col gap-4 rounded bg-gray-100 dark:bg-gray-700 md:min-w-[425px] md:max-w-full"
              ref={refs.setFloating}
              {...getFloatingProps()}
            >
              <button
                className="absolute right-2 top-2"
                onClick={() => onClose(false)}
              >
                <IconX className="text-gray-500 hover:text-blue-500" />
              </button>
              <div className="flex flex-col gap-2 overflow-auto">
                <div className="flex justify-between px-6 pt-4">
                  <h2 id={headingId} className="text-base font-semibold">
                    {t('Select folder')}
                  </h2>
                </div>
                {showSpinner ? (
                  <div className="flex min-h-[300px] items-center justify-center px-6 pb-4">
                    <Spinner />
                  </div>
                ) : (
                  <div className="group/modal flex flex-col gap-2 overflow-auto px-6 pb-4">
                    <ErrorMessage error={errorMessage} />

                    <input
                      name="titleInput"
                      placeholder={t('Search folders') || ''}
                      type="text"
                      onChange={handleSearch}
                      className="m-0 w-full rounded border border-gray-400 bg-transparent px-3 py-2 outline-none placeholder:text-gray-500 focus-visible:border-blue-500 dark:border-gray-600 dark:focus-visible:border-blue-500"
                    ></input>
                    <div className="flex min-h-[350px] flex-col overflow-auto">
                      <button
                        className={classNames(
                          'mb-0.5 flex items-center gap-1 rounded border-l-2 py-1 text-xs text-gray-500',
                          !selectedFolderId
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-transparent',
                        )}
                        onClick={() => handleToggleFolder(undefined)}
                      >
                        <CaretIconComponent isOpen={isAllFilesOpened} />
                        {t('All files')}
                      </button>
                      {isAllFilesOpened && (
                        <div className="flex min-h-[250px] flex-col gap-0.5 overflow-auto">
                          {filteredFolders.length !== 0 ? (
                            <div className="flex flex-col gap-1 overflow-auto">
                              {filteredFolders.map((folder) => {
                                if (folder.folderId) {
                                  return null;
                                }

                                return (
                                  <div key={folder.id}>
                                    <Folder
                                      searchTerm={searchQuery}
                                      currentFolder={folder}
                                      allFolders={folders}
                                      highlightColor={HighlightColor.Blue}
                                      highlightedFolders={highlightedFolders}
                                      isInitialRenameEnabled
                                      newAddedFolderId={newFolderId}
                                      loadingFolderId={loadingFolderId}
                                      openedFoldersIds={openedFoldersIds}
                                      onClickFolder={handleFolderSelect}
                                      onAddFolder={handleAddFolder}
                                      onRenameFolder={handleRenameFolder}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex grow items-center justify-center">
                              <NoResultsFound />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-300 px-6 py-4 dark:border-gray-900">
                  <div className="flex items-center justify-center">
                    <button
                      onClick={handleNewFolder}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded text-gray-500  hover:bg-blue-500/20 hover:text-blue-500"
                    >
                      <FolderPlus
                        height={24}
                        width={24}
                        className="text-gray-500 hover:text-blue-500"
                      />
                    </button>
                  </div>
                  <div>
                    <button
                      onClick={() => onClose(selectedFolderId)}
                      className="button button-primary"
                    >
                      {t('Select folder')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
};
