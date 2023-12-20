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
import { IconDownload, IconTrash, IconX } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getDialFilesWithInvalidFileType,
  getExtensionsListForMimeTypes,
  notAllowedSymbols,
  notAllowedSymbolsRegex,
} from '@/src/utils/app/file';
import { getChildAndCurrentFoldersIdsById } from '@/src/utils/app/folders';

import { HighlightColor } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';
import Folder from '@/src/components/Folder/Folder';

import FolderPlus from '../../../public/images/icons/folder-plus.svg';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Spinner } from '../Common/Spinner';
import { FileItem, FileItemEventIds } from './FileItem';
import { PreUploadDialog } from './PreUploadModal';

interface Props {
  isOpen: boolean;
  initialSelectedFilesIds?: string[];
  allowedTypes?: string[];
  maximumAttachmentsAmount?: number;
  isInConversation?: boolean;
  onClose: (result: boolean | string[]) => void;
}

const loadingStatuses = new Set(['LOADING', undefined]);

export const FileManagerModal = ({
  isOpen,
  allowedTypes = [],
  initialSelectedFilesIds = [],
  isInConversation = false,
  maximumAttachmentsAmount = 0,
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
  const descriptionId = useId();

  const folders = useAppSelector(FilesSelectors.selectFolders);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const newFolderId = useAppSelector(FilesSelectors.selectNewAddedFolderId);
  const foldersStatus = useAppSelector(FilesSelectors.selectFoldersStatus);
  const loadingFolderId = useAppSelector(FilesSelectors.selectLoadingFolderId);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [isAllFilesOpened, setIsAllFilesOpened] = useState(true);
  const [uploadFolderId, setUploadFolderId] = useState<string | undefined>(
    undefined,
  );
  const [isUploadFromDeviceOpened, setIsUploadFromDeviceOpened] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilesIds, setSelectedFilesIds] = useState(
    initialSelectedFilesIds,
  );
  const filteredFiles = useMemo(() => {
    return files.filter(({ name }) =>
      name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [files, searchQuery]);
  const allowedExtensions = useMemo(() => {
    if (allowedTypes.includes('*/*')) {
      return [t('all')];
    }
    return getExtensionsListForMimeTypes(allowedTypes);
  }, [allowedTypes, t]);
  const showSpinner =
    folders.length === 0 && loadingStatuses.has(foldersStatus);

  useEffect(() => {
    if (isOpen) {
      dispatch(FilesActions.getFilesWithFolders({}));
      dispatch(FilesActions.resetNewFolderId());
    }
  }, [dispatch, isOpen]);

  const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleNewFolder = useCallback(() => {
    dispatch(FilesActions.addNewFolder({}));
    setIsAllFilesOpened(true);
  }, [dispatch]);

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
    [dispatch, folders, openedFoldersIds],
  );

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      handleToggleFolder(folderId);
    },
    [handleToggleFolder],
  );

  const handleAddFolder = useCallback(
    (relativePath: string) => {
      dispatch(FilesActions.addNewFolder({ relativePath }));

      if (!openedFoldersIds.includes(relativePath)) {
        setOpenedFoldersIds(openedFoldersIds.concat(relativePath));
        dispatch(FilesActions.getFolders({ path: relativePath }));
      }
    },
    [dispatch, openedFoldersIds],
  );

  const handleUploadFile = useCallback(
    (relativePath: string) => {
      setUploadFolderId(relativePath);
      setIsUploadFromDeviceOpened(true);

      if (!openedFoldersIds.includes(relativePath)) {
        setOpenedFoldersIds(openedFoldersIds.concat(relativePath));
        dispatch(FilesActions.getFolders({ path: relativePath }));
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

      if (newName.match(notAllowedSymbolsRegex)) {
        setErrorMessage(
          t(
            `The symbols ${notAllowedSymbols.join(
              '',
            )} are not allowed in folder name`,
          ) as string,
        );
        return;
      }
      dispatch(FilesActions.renameFolder({ folderId, newName }));
    },
    [dispatch, folders, t],
  );

  const handleItemCallback = useCallback(
    (eventId: string, data: unknown) => {
      if (typeof data !== 'string') {
        return;
      }

      switch (eventId) {
        case FileItemEventIds.Retry:
          dispatch(FilesActions.reuploadFile({ fileId: data }));
          break;
        case FileItemEventIds.Toggle:
          setSelectedFilesIds((oldValues) => {
            if (oldValues.includes(data)) {
              return oldValues.filter((oldValue) => oldValue !== data);
            }

            return oldValues.concat(data);
          });
          break;
        case FileItemEventIds.Cancel:
        case FileItemEventIds.Remove:
          dispatch(FilesActions.removeFile({ fileId: data }));
          break;
        default:
          break;
      }
    },
    [dispatch],
  );

  const handleAttachFiles = useCallback(() => {
    if (selectedFilesIds.length > maximumAttachmentsAmount) {
      setErrorMessage(
        t(
          `Maximum allowed attachments number is {{maxAttachmentsAmount}}. You've selected {{selectedAttachmentsAmount}}`,
          {
            maxAttachmentsAmount: maximumAttachmentsAmount,
            selectedAttachmentsAmount: selectedFilesIds.length,
          },
        ) as string,
      );
      return;
    }

    const selectedFiles = files.filter((file) =>
      selectedFilesIds.includes(file.id),
    );
    const filesWithIncorrectTypes = getDialFilesWithInvalidFileType(
      selectedFiles,
      allowedTypes,
    ).map((file) => file.name);
    if (filesWithIncorrectTypes.length > 0) {
      setErrorMessage(
        t(
          `Supported types: {{allowedExtensions}}. You've trying to upload files with incorrect type: {{incorrectTypeFileNames}}`,
          {
            allowedExtensions: allowedExtensions.join(', '),
            incorrectTypeFileNames: filesWithIncorrectTypes.join(', '),
          },
        ) as string,
      );
      return;
    }

    onClose(selectedFilesIds);
  }, [
    allowedExtensions,
    allowedTypes,
    files,
    maximumAttachmentsAmount,
    onClose,
    selectedFilesIds,
    t,
  ]);

  const handleStartUploadFiles = useCallback(() => {
    setUploadFolderId(undefined);
    setIsUploadFromDeviceOpened(true);
  }, []);

  const handleUploadFiles = useCallback(
    (
      selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
      folderPath: string | undefined,
    ) => {
      selectedFiles.forEach((file) => {
        dispatch(
          FilesActions.uploadFile({
            fileContent: file.fileContent,
            id: file.id,
            relativePath: folderPath,
            name: file.name,
          }),
        );
      });
    },
    [dispatch],
  );

  const handleRemoveMultipleFiles = useCallback(() => {
    if (!selectedFilesIds.length) {
      return;
    }

    dispatch(FilesActions.removeFilesList({ fileIds: selectedFilesIds }));
    setSelectedFilesIds([]);
  }, [dispatch, selectedFilesIds]);

  const handleDownloadMultipleFiles = useCallback(() => {
    if (!selectedFilesIds.length) {
      return;
    }

    dispatch(FilesActions.downloadFilesList({ fileIds: selectedFilesIds }));
    setSelectedFilesIds([]);
  }, [dispatch, selectedFilesIds]);

  return (
    <FloatingPortal id="theme-main">
      {isOpen && (
        <FloatingOverlay
          lockScroll
          className="z-50 flex items-center justify-center bg-gray-900/70 p-3 dark:bg-gray-900/30"
        >
          <FloatingFocusManager context={context}>
            <div
              className="relative flex max-h-full flex-col gap-4 rounded bg-gray-100 dark:bg-gray-700 md:w-[525px]"
              ref={refs.setFloating}
              {...getFloatingProps()}
            >
              <button
                className="absolute right-2 top-2 text-gray-500 hover:text-blue-500"
                onClick={() => onClose(false)}
              >
                <IconX />
              </button>
              <div className="flex flex-col gap-2 overflow-auto p-6">
                <div className="flex justify-between">
                  <h2 id={headingId} className="text-base font-semibold">
                    {isInConversation
                      ? t('Attach files')
                      : t('Manage attachments')}
                  </h2>
                </div>
                <p id={descriptionId}>
                  {t(
                    'Max file size up to 512 Mb. Supported types: {{allowedExtensions}}.',
                    {
                      allowedExtensions: allowedExtensions.join(', '),
                    },
                  )}
                  &nbsp;
                  {maximumAttachmentsAmount !== Number.MAX_SAFE_INTEGER &&
                    t('Max selected files is {{maxAttachmentsAmount}}.', {
                      maxAttachmentsAmount: maximumAttachmentsAmount,
                    })}
                </p>

                <ErrorMessage error={errorMessage} />

                {showSpinner ? (
                  <div className="flex min-h-[300px] items-center justify-center">
                    <Spinner />
                  </div>
                ) : (
                  <div className="group/modal flex flex-col gap-2 overflow-auto">
                    <input
                      name="titleInput"
                      placeholder={t('Search files') || ''}
                      type="text"
                      onChange={handleSearch}
                      className="m-0 w-full rounded border border-gray-400 bg-transparent px-3 py-2 outline-none placeholder:text-gray-500 focus-visible:border-blue-500 dark:border-gray-600 dark:focus-visible:border-blue-500"
                    ></input>
                    <div className="flex min-h-[350px] flex-col overflow-auto">
                      <button
                        className="flex items-center gap-1 rounded py-1 text-xs text-gray-500"
                        onClick={() => handleToggleFolder(undefined)}
                      >
                        <CaretIconComponent isOpen={isAllFilesOpened} />
                        {t('All files')}
                      </button>
                      {isAllFilesOpened && (
                        <div className="flex min-h-[250px] flex-col gap-0.5 overflow-auto">
                          {(folders.length !== 0 ||
                            filteredFiles.length !== 0) && (
                            <div className="flex flex-col gap-1 overflow-auto">
                              {folders.map((folder) => {
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
                                      highlightedFolders={[]}
                                      isInitialRenameEnabled
                                      newAddedFolderId={newFolderId}
                                      displayCaretAlways
                                      loadingFolderId={loadingFolderId}
                                      openedFoldersIds={openedFoldersIds}
                                      allItems={filteredFiles}
                                      additionalItemData={{ selectedFilesIds }}
                                      itemComponent={FileItem}
                                      onClickFolder={handleFolderSelect}
                                      onAddFolder={handleAddFolder}
                                      onFileUpload={handleUploadFile}
                                      onRenameFolder={handleRenameFolder}
                                      onItemEvent={handleItemCallback}
                                    />
                                  </div>
                                );
                              })}
                              {filteredFiles.map((file) => {
                                if (file.folderId) {
                                  return null;
                                }

                                return (
                                  <div key={file.id}>
                                    <FileItem
                                      item={file}
                                      level={0}
                                      additionalItemData={{ selectedFilesIds }}
                                      onEvent={handleItemCallback}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-gray-300 px-6 py-4 dark:border-gray-900">
                <div className="flex items-center justify-center gap-2">
                  {selectedFilesIds.length > 0 ? (
                    <>
                      <button
                        onClick={handleRemoveMultipleFiles}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded text-gray-500  hover:bg-blue-500/20 hover:text-blue-500"
                      >
                        <IconTrash size={24} />
                      </button>
                      <button
                        onClick={handleDownloadMultipleFiles}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded text-gray-500  hover:bg-blue-500/20 hover:text-blue-500"
                      >
                        <IconDownload size={24} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleNewFolder}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded text-gray-500  hover:bg-blue-500/20 hover:text-blue-500"
                    >
                      <FolderPlus height={24} width={24} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleStartUploadFiles}
                    className={classNames(
                      'button',
                      isInConversation ? 'button-secondary' : 'button-primary',
                    )}
                  >
                    {t('Upload from device')}
                  </button>
                  {isInConversation && (
                    <button
                      onClick={handleAttachFiles}
                      className="button button-primary"
                      disabled={selectedFilesIds.length === 0}
                    >
                      {t('Attach files')}
                    </button>
                  )}
                </div>
              </div>

              {isUploadFromDeviceOpened && (
                <PreUploadDialog
                  uploadFolderId={uploadFolderId}
                  isOpen
                  allowedTypes={allowedTypes}
                  initialFilesSelect
                  onUploadFiles={handleUploadFiles}
                  onClose={() => setIsUploadFromDeviceOpened(false)}
                />
              )}
            </div>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
};
