import { useId } from '@floating-ui/react';
import { IconDownload, IconTrash } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useHandleFileFolders } from '@/src/hooks/useHandleFileFolders';

import {
  getDialFilesWithInvalidFileType,
  getShortExtentionsListFromMimeType,
} from '@/src/utils/app/file';
import { getFileRootId, isRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';
import Modal from '@/src/components/Common/Modal';
import Folder from '@/src/components/Folder/Folder';

import FolderPlus from '../../../public/images/icons/folder-plus.svg';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Spinner } from '../Common/Spinner';
import Tooltip from '../Common/Tooltip';
import { FileItem, FileItemEventIds } from './FileItem';
import { PreUploadDialog } from './PreUploadModal';

interface Props {
  isOpen: boolean;
  initialSelectedFilesIds?: string[];
  allowedTypes?: string[];
  allowedTypesLabel?: string | null;
  maximumAttachmentsAmount?: number;
  headerLabel: string;
  customButtonLabel?: string;
  customUploadButtonLabel?: string;
  onClose: (result: boolean | string[]) => void;
}

export const FileManagerModal = ({
  isOpen,
  allowedTypes = [],
  allowedTypesLabel,
  initialSelectedFilesIds = [],
  headerLabel,
  customButtonLabel,
  customUploadButtonLabel,
  maximumAttachmentsAmount = 0,
  onClose,
}: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const headingId = useId();
  const descriptionId = useId();

  const folders = useAppSelector(FilesSelectors.selectFolders);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const newFolderId = useAppSelector(FilesSelectors.selectNewAddedFolderId);
  const areFoldersLoading = useAppSelector(
    FilesSelectors.selectAreFoldersLoading,
  );
  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );
  const canAttachFolders = useAppSelector(
    ConversationsSelectors.selectCanAttachFolders,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [isAllFilesOpened, setIsAllFilesOpened] = useState(true);
  const [uploadFolderId, setUploadFolderId] = useState<string | undefined>(
    getFileRootId(),
  );
  const [isUploadFromDeviceOpened, setIsUploadFromDeviceOpened] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilesIds, setSelectedFilesIds] = useState(
    initialSelectedFilesIds,
  );
  const [selectedFolderIds, setSelectedFolderIds] = useState(
    initialSelectedFilesIds,
  );
  const [deletingFileIds, setDeletingFileIds] = useState<string[]>([]);
  const [deletingFolderIds, setDeletingFolderIds] = useState<string[]>([]);

  const {
    handleRenameFolder,
    handleAddFolder,
    handleToggleFolder,
    handleNewFolder,
  } = useHandleFileFolders(
    folders,
    openedFoldersIds,
    getFileRootId(),
    setErrorMessage,
    setOpenedFoldersIds,
    setIsAllFilesOpened,
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

    return getShortExtentionsListFromMimeType(allowedTypes, t);
  }, [allowedTypes, t]);

  const typesLabel = useMemo(() => {
    if (allowedTypesLabel) {
      return allowedTypesLabel;
    }
    if (
      allowedTypes.length === 1 &&
      allowedTypes[0].endsWith('/*') &&
      !allowedTypes[0].startsWith('*/')
    ) {
      return t(allowedTypes[0].replace('/*', 's'));
    }
  }, [allowedTypes, allowedTypesLabel, t]);

  const showSpinner = folders.length === 0 && areFoldersLoading;

  useEffect(() => {
    if (isOpen) {
      dispatch(FilesActions.getFilesWithFolders({}));
      dispatch(FilesActions.resetNewFolderId());
    }
  }, [dispatch, isOpen]);

  const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      handleToggleFolder(folderId);
    },
    [handleToggleFolder],
  );

  const handleUploadFile = useCallback(
    (relativePath: string) => {
      setUploadFolderId(relativePath);
      setIsUploadFromDeviceOpened(true);

      if (!openedFoldersIds.includes(relativePath)) {
        setOpenedFoldersIds(openedFoldersIds.concat(relativePath));
        dispatch(FilesActions.getFolders({ id: relativePath }));
      }
    },
    [dispatch, openedFoldersIds],
  );

  const handleStartDeleteMultipleFiles = useCallback(() => {
    if (!selectedFilesIds.length && !selectedFolderIds.length) {
      return;
    }

    setDeletingFileIds(selectedFilesIds);
    setDeletingFolderIds(selectedFolderIds);
  }, [selectedFilesIds, selectedFolderIds]);

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
          dispatch(FilesActions.deleteFile({ fileId: data }));
          break;
        case FileItemEventIds.Delete:
          setDeletingFileIds([data]);
          break;
        default:
          break;
      }
    },
    [dispatch],
  );

  const handleFolderCallback = useCallback((eventId: string, data: unknown) => {
    if (typeof data !== 'string') {
      return;
    }

    switch (eventId) {
      case FileItemEventIds.Toggle:
        setSelectedFolderIds((oldValues) => {
          if (oldValues.includes(data)) {
            return oldValues.filter((oldValue) => oldValue !== data);
          }

          return oldValues.concat(data);
        });
        break;
      default:
        break;
    }
  }, []);

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
          `You've trying to upload files with incorrect type: {{incorrectTypeFileNames}}`,
          {
            incorrectTypeFileNames: filesWithIncorrectTypes.join(', '),
          },
        ) as string,
      );
      return;
    }

    onClose(selectedFilesIds);
  }, [
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

  const handleDeleteMultipleFiles = useCallback(() => {
    if (!deletingFileIds.length && !deletingFolderIds.length) {
      return;
    }
    if (deletingFileIds.length) {
      dispatch(FilesActions.deleteFilesList({ fileIds: deletingFileIds }));
      if (selectedFilesIds === deletingFileIds) {
        setSelectedFilesIds([]);
      }
    }
    if (deletingFolderIds.length) {
      // TODO: implement
      // dispatch(FilesActions.deleteFolderList({ folderIds: deletingFolderIds }));
      if (selectedFolderIds === deletingFolderIds) {
        setSelectedFolderIds([]);
      }
    }
  }, [
    deletingFileIds,
    deletingFolderIds,
    dispatch,
    selectedFilesIds,
    selectedFolderIds,
  ]);

  const handleDownloadMultipleFiles = useCallback(() => {
    if (!selectedFilesIds.length) {
      return;
    }

    dispatch(FilesActions.downloadFilesList({ fileIds: selectedFilesIds }));
    setSelectedFilesIds([]);
  }, [dispatch, selectedFilesIds]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="file-manager-modal"
      containerClassName="flex flex-col gap-4 sm:w-[525px] w-full"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="flex flex-col gap-2 overflow-auto p-6">
        <div className="flex justify-between">
          <h2 id={headingId} className="text-base font-semibold">
            {headerLabel}
          </h2>
        </div>
        <p id={descriptionId}>
          {t(
            'Max file size up to 512 Mb. Supported types: {{allowedExtensions}}.',
            {
              allowedExtensions:
                typesLabel ||
                allowedExtensions.join(', ') ||
                'no available extensions',
            },
          )}
          &nbsp;
          {maximumAttachmentsAmount !== Number.MAX_SAFE_INTEGER &&
            !!maximumAttachmentsAmount &&
            t('Max selected files is {{maxAttachmentsAmount}}.', {
              maxAttachmentsAmount: maximumAttachmentsAmount,
            })}
        </p>

        <ErrorMessage error={errorMessage} />

        {showSpinner ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size={30} />
          </div>
        ) : (
          <div className="group/modal flex flex-col gap-2 overflow-auto">
            <input
              name="titleInput"
              placeholder={t('Search files') || ''}
              type="text"
              onChange={handleSearch}
              className="m-0 w-full rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
            ></input>
            <div className="flex min-h-[350px] flex-col overflow-auto">
              <button
                className="flex items-center gap-1 rounded py-1 text-xs text-secondary"
                onClick={() => handleToggleFolder(getFileRootId())}
              >
                <CaretIconComponent isOpen={isAllFilesOpened} />
                {t('All files')}
              </button>
              {isAllFilesOpened && (
                <div className="flex flex-col gap-0.5 overflow-auto">
                  {(folders.length !== 0 || filteredFiles.length !== 0) && (
                    <div className="flex flex-col gap-1 overflow-auto">
                      {folders.map((folder) => {
                        if (!isRootId(folder.folderId)) {
                          return null;
                        }

                        return (
                          <div key={folder.id}>
                            <Folder
                              searchTerm={searchQuery}
                              currentFolder={folder}
                              allFolders={folders}
                              highlightedFolders={[]}
                              isInitialRenameEnabled
                              newAddedFolderId={newFolderId}
                              displayCaretAlways
                              loadingFolderIds={loadingFolderIds}
                              openedFoldersIds={openedFoldersIds}
                              allItems={filteredFiles}
                              additionalItemData={{
                                selectedFilesIds,
                              }}
                              itemComponent={FileItem}
                              onClickFolder={handleFolderSelect}
                              onAddFolder={handleAddFolder}
                              onFileUpload={handleUploadFile}
                              onRenameFolder={handleRenameFolder}
                              skipFolderRenameValidation
                              onItemEvent={handleItemCallback}
                              onFolderEvent={handleFolderCallback}
                              withBorderHighlight={false}
                              featureType={FeatureType.File}
                              canAttachFolders={canAttachFolders}
                            />
                          </div>
                        );
                      })}
                      {filteredFiles.map((file) => {
                        if (!isRootId(file.folderId)) {
                          return null;
                        }

                        return (
                          <div key={file.id}>
                            <FileItem
                              item={file}
                              level={0}
                              additionalItemData={{
                                selectedFilesIds,
                              }}
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
      <div className="flex items-center justify-between border-t border-primary px-6 py-4">
        <div className="flex items-center justify-center gap-2">
          {(selectedFilesIds.length > 0 || selectedFolderIds.length > 0) && (
            <button
              onClick={handleStartDeleteMultipleFiles}
              className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha  hover:text-accent-primary"
            >
              <Tooltip tooltip="Delete files" isTriggerClickable>
                <IconTrash size={24} />
              </Tooltip>
            </button>
          )}
          {selectedFilesIds.length > 0 && (
            <button
              onClick={handleDownloadMultipleFiles}
              className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha  hover:text-accent-primary"
            >
              <Tooltip tooltip="Download files" isTriggerClickable>
                <IconDownload size={24} />
              </Tooltip>
            </button>
          )}
          {selectedFilesIds.length === 0 && selectedFolderIds.length === 0 && (
            <button
              onClick={handleNewFolder}
              className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha  hover:text-accent-primary"
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
              customButtonLabel ? 'button-secondary' : 'button-primary',
            )}
          >
            {t('Upload from device')}
          </button>
          {customButtonLabel && (
            <button
              onClick={handleAttachFiles}
              className="button button-primary"
              disabled={
                selectedFilesIds.length === 0 || selectedFolderIds.length === 0
              }
            >
              {customButtonLabel}
            </button>
          )}
        </div>
      </div>

      {isUploadFromDeviceOpened && (
        <PreUploadDialog
          uploadFolderId={uploadFolderId}
          isOpen
          allowedTypes={allowedTypes}
          allowedTypesLabel={typesLabel}
          initialFilesSelect
          onUploadFiles={handleUploadFiles}
          onClose={() => setIsUploadFromDeviceOpened(false)}
          maximumAttachmentsAmount={Number.MAX_SAFE_INTEGER}
          customUploadButtonLabel={customUploadButtonLabel}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingFileIds.length || !!deletingFolderIds.length}
        heading={t(
          [
            'Confirm deleting ',
            deletingFolderIds.length > 0
              ? `folder${deletingFolderIds.length > 1 ? 's' : ''}`
              : '',
            deletingFileIds.length > 0 && deletingFolderIds.length > 0
              ? ' and '
              : '',
            deletingFileIds.length > 0
              ? `file${deletingFileIds.length > 1 ? 's' : ''}`
              : '',
          ].join(''),
        )}
        description={
          t(
            [
              'Are you sure that you want to delete ',
              deletingFileIds.length + deletingFolderIds.length > 1
                ? 'these '
                : 'this ',
              deletingFolderIds.length > 0
                ? `folder${deletingFolderIds.length > 1 ? 's' : ''}`
                : '',
              deletingFileIds.length > 0 && deletingFolderIds.length > 0
                ? ' and '
                : '',
              deletingFileIds.length > 0
                ? `file${deletingFileIds.length > 1 ? 's' : ''}`
                : '',
            ].join(''),
          ) || ''
        }
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          if (result) {
            handleDeleteMultipleFiles();
          }
          setDeletingFileIds([]);
          setDeletingFolderIds([]);
        }}
      />
    </Modal>
  );
};
