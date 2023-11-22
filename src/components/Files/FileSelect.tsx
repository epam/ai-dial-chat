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
import { IconCaretRightFilled, IconX } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getChildAndCurrentFoldersIdsById } from '@/src/utils/app/folders';

import { DialFile } from '@/src/types/files';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import FolderPlus from '../../../public/images/icons/folder-plus.svg';
import { Spinner } from '../Common/Spinner';
import Folder from '../Folder';
import { FileItem, FileItemEventIds } from './FileItem';
import { PreUploadDialog } from './PreUploadModal';

interface Props {
  isOpen: boolean;
  allowedTypes?: string[];
  maximumAttachmentsAmount?: number;
  onClose: (result: boolean | string[]) => void;
}

const loadingStatuses = new Set(['LOADING', undefined]);

export const FileSelect = ({
  isOpen,
  allowedTypes = [],
  maximumAttachmentsAmount = 0,
  onClose,
}: Props) => {
  const dispatch = useAppDispatch();
  const attachedFilesIds = useAppSelector(
    FilesSelectors.selectSelectedFilesIds,
  );

  const { t } = useTranslation('chat');

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
  const foldersStatus = useAppSelector(FilesSelectors.selectFoldersStatus);
  const loadingFolderId = useAppSelector(FilesSelectors.selectLoadingFolderId);
  const newAddedFolderId = useAppSelector(
    FilesSelectors.selectNewAddedFolderId,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [isAllFilesOpened, setIsAllFilesOpened] = useState(true);
  const [isUploadFromDeviceOpened, setIsUploadFromDeviceOpened] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilesIds, setSelectedFilesIds] = useState(attachedFilesIds);
  const filteredFolders = useMemo(() => {
    return folders.filter(({ name }) =>
      name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [folders, searchQuery]);
  const filteredFiles = useMemo(() => {
    return files.filter(({ name }) =>
      name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [files, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      dispatch(FilesActions.getFilesWithFolders({}));
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
  const handleRenameFolder = useCallback(
    (newName: string, folderId: string) => {
      const folderWithSameName = folders.find(
        (folder) => folder.name === newName,
      );

      if (folderWithSameName) {
        dispatch(
          UIActions.showToast({
            message: t(`Not allowed to have folders with same names`),
            type: 'error',
          }),
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

    onClose(selectedFilesIds);
  }, [maximumAttachmentsAmount, onClose, selectedFilesIds, t]);

  return (
    <FloatingPortal id="theme-main">
      {isOpen && (
        <FloatingOverlay
          lockScroll
          className="z-50 flex items-center justify-center bg-gray-900/70 p-3 dark:bg-gray-900/30"
        >
          <FloatingFocusManager context={context}>
            <div
              className="relative flex max-h-full flex-col gap-4 rounded bg-gray-100 p-6 dark:bg-gray-700 md:w-[525px]"
              ref={refs.setFloating}
              {...getFloatingProps()}
            >
              <button
                className="absolute right-2 top-2"
                onClick={() => onClose(false)}
              >
                <IconX className="text-gray-500" />
              </button>
              <div className="flex flex-col gap-2 overflow-auto">
                <div className="flex justify-between">
                  <h2 id={headingId} className="text-base font-semibold">
                    {t('Attach files')}
                  </h2>
                </div>
                <p id={descriptionId}>
                  {t(
                    'Max file size up to 512 Mb. Supported types: {{allowedTypes}}.',
                    {
                      allowedTypes: allowedTypes.join(', '),
                    },
                  )}
                  &nbsp;
                  {maximumAttachmentsAmount !== Number.MAX_SAFE_INTEGER &&
                    t('Max selected files is {{maxAttachmentsAmount}}.', {
                      maxAttachmentsAmount: maximumAttachmentsAmount,
                    })}
                </p>
                {errorMessage && errorMessage?.length > 0 && (
                  <p className="rounded bg-red-200 p-3 text-red-800 dark:bg-red-900 dark:text-red-400">
                    {errorMessage}
                  </p>
                )}
                {folders.length === 0 && loadingStatuses.has(foldersStatus) ? (
                  <div className="flex min-h-[300px] items-center justify-center">
                    <Spinner />
                  </div>
                ) : (
                  <div className="group/modal flex flex-col gap-2 overflow-auto">
                    <input
                      name="titleInput"
                      placeholder={
                        t('Search model, assistant or application') || ''
                      }
                      type="text"
                      onChange={handleSearch}
                      className="m-0 w-full rounded border border-gray-400 bg-transparent px-3 py-2 outline-none placeholder:text-gray-500 focus-visible:border-blue-500 dark:border-gray-600 dark:focus-visible:border-blue-500"
                    ></input>
                    <div className="flex min-h-[350px] flex-col overflow-auto">
                      <button
                        className={classNames(
                          'flex items-center gap-0.5 rounded py-1 text-xs text-gray-500',
                        )}
                        onClick={() => handleToggleFolder(undefined)}
                      >
                        <IconCaretRightFilled
                          className={classNames(
                            'invisible text-gray-500 transition-all group-hover/modal:visible',
                            isAllFilesOpened && 'rotate-90',
                          )}
                          size={10}
                        />
                        {t('All files')}
                      </button>
                      {isAllFilesOpened && (
                        <div className="flex min-h-[250px] flex-col gap-0.5 overflow-auto">
                          {(filteredFolders.length !== 0 ||
                            filteredFiles.length !== 0) && (
                            <div className="overflow-auto">
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
                                      highlightColor="blue"
                                      highlightedFolders={[]}
                                      isInitialRename={
                                        newAddedFolderId === folder.id
                                      }
                                      displayCaretAlways={true}
                                      loadingFolderId={loadingFolderId}
                                      openedFoldersIds={openedFoldersIds}
                                      allItems={files}
                                      itemComponent={FileItem}
                                      onClickFolder={handleFolderSelect}
                                      onAddFolder={handleAddFolder}
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
                    <div className="flex items-center justify-between">
                      <div>
                        <button onClick={handleNewFolder}>
                          <FolderPlus
                            height={24}
                            width={24}
                            className="text-gray-500 hover:text-blue-500"
                          />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsUploadFromDeviceOpened(true)}
                          className="button button-secondary"
                        >
                          {t('Upload from device')}
                        </button>
                        <button
                          onClick={handleAttachFiles}
                          className="button button-primary"
                          disabled={selectedFilesIds.length === 0}
                        >
                          {t('Attach files')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <PreUploadDialog
                isOpen={isUploadFromDeviceOpened}
                allowedTypes={allowedTypes}
                initialFilesSelect={true}
                onUploadFiles={(
                  selectedFiles: Required<
                    Pick<DialFile, 'fileContent' | 'id' | 'name'>
                  >[],
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
                }}
                onClose={() => setIsUploadFromDeviceOpened(false)}
              />
            </div>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
};
