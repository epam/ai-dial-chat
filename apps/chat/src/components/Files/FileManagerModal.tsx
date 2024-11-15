import { useId } from '@floating-ui/react';
import { IconDownload, IconTrash } from '@tabler/icons-react';
import {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useHandleFileFolders } from '@/src/hooks/useHandleFileFolders';
import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import {
  getDialFilesWithInvalidFileType,
  getShortExtensionsListFromMimeType,
} from '@/src/utils/app/file';
import { getParentFolderIdsFromFolderId } from '@/src/utils/app/folders';
import { getFileRootId, isFolderId } from '@/src/utils/app/id';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
  defaultMyItemsFilters,
} from '@/src/utils/app/search';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions } from '@/src/store/share/share.reducers';

import Modal from '@/src/components/Common/Modal';

import FolderPlus from '../../../public/images/icons/folder-plus.svg';
import CollapsibleSection from '../Common/CollapsibleSection';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { ErrorMessage } from '../Common/ErrorMessage';
import { NoData } from '../Common/NoData';
import { NoResultsFound } from '../Common/NoResultsFound';
import { Spinner } from '../Common/Spinner';
import Tooltip from '../Common/Tooltip';
import Folder from '../Folder/Folder';
import { FileItem, FileItemEventIds } from './FileItem';
import { PreUploadDialog } from './PreUploadModal';

import uniq from 'lodash-es/uniq';

interface FilesSectionProps {
  name: string;
  dataQa: string;
  children: ReactNode;
  files: DialFile[];
  folders: FolderInterface[];
}

const FilesSectionWrapper = ({
  name,
  dataQa,
  folders,
  files,
  children,
}: FilesSectionProps) => {
  const { handleToggle, isExpanded } = useSectionToggle(name, FeatureType.File);

  const isNothingExists = folders.length === 0 && files.length === 0;

  if (isNothingExists) return null;

  return (
    <CollapsibleSection
      onToggle={handleToggle}
      name={name}
      openByDefault={isExpanded}
      dataQa={dataQa}
      className="!p-0"
      togglerClassName="ml-0.5"
    >
      <div className="flex flex-col overflow-auto">
        <div className="flex grow flex-col gap-0.5 overflow-auto">
          {children}
        </div>
      </div>
    </CollapsibleSection>
  );
};

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
  forceShowSelectCheckBox?: boolean;
  forceHideSelectFolders?: boolean;
  showTooltip?: boolean;
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
  forceShowSelectCheckBox,
  forceHideSelectFolders,
  onClose,
  showTooltip,
}: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const headingId = useId();
  const descriptionId = useId();

  const [searchQuery, setSearchQuery] = useState('');

  const newFolderId = useAppSelector(FilesSelectors.selectNewAddedFolderId);
  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const myRootFiles = useAppSelector((state) =>
    FilesSelectors.selectFilteredFiles(
      state,
      defaultMyItemsFilters,
      searchQuery,
    ),
  );
  const myRootFolders = useAppSelector((state) =>
    FilesSelectors.selectFilteredFolders(
      state,
      defaultMyItemsFilters,
      searchQuery,
    ),
  );
  const organizationRootFiles = useAppSelector((state) =>
    FilesSelectors.selectFilteredFiles(
      state,
      PublishedWithMeFilter,
      searchQuery,
    ),
  );
  const organizationRootFolders = useAppSelector((state) =>
    FilesSelectors.selectFilteredFolders(
      state,
      PublishedWithMeFilter,
      searchQuery,
    ),
  );

  const sharedWithMeRootFolders = useAppSelector((state) =>
    FilesSelectors.selectFilteredFolders(
      state,
      SharedWithMeFilters,
      searchQuery,
    ),
  );

  const sharedWithMeRootFiles = useAppSelector((state) =>
    FilesSelectors.selectFilteredFiles(state, SharedWithMeFilters, searchQuery),
  );

  const areFoldersLoading = useAppSelector(
    FilesSelectors.selectAreFoldersLoading,
  );
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );
  const canAttachFolders =
    useAppSelector(ConversationsSelectors.selectCanAttachFolders) &&
    !forceHideSelectFolders;

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState<string | undefined>(
    getFileRootId(),
  );
  const [isUploadFromDeviceOpened, setIsUploadFromDeviceOpened] =
    useState(false);
  const [selectedFilesIds, setSelectedFilesIds] = useState(
    canAttachFiles || forceShowSelectCheckBox
      ? initialSelectedFilesIds.filter((id) => !isFolderId(id))
      : [],
  );
  const [selectedNoDeleteFilesIds, setSelectedNoDeleteFilesIds] = useState<
    string[]
  >([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState(
    canAttachFolders
      ? initialSelectedFilesIds.filter((id) => isFolderId(id))
      : [],
  );
  const [deletingFileIds, setDeletingFileIds] = useState<string[]>([]);
  const [deletingFolderIds, setDeletingFolderIds] = useState<string[]>([]);

  const highlightFolderIds = useMemo(() => {
    return uniq(
      selectedFolderIds
        .flatMap((folderId) => getParentFolderIdsFromFolderId(folderId))
        .concat(
          selectedFilesIds.flatMap((f) => getParentFolderIdsFromFolderId(f)),
        ),
    );
  }, [selectedFilesIds, selectedFolderIds]);

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
  );

  const allowedTypesArray = useMemo(
    () => (!canAttachFiles && canAttachFolders ? ['*/*'] : allowedTypes),
    [allowedTypes, canAttachFiles, canAttachFolders],
  );

  const allowedExtensions = useMemo(() => {
    if (allowedTypesArray.includes('*/*')) {
      return [t('all')];
    }

    return getShortExtensionsListFromMimeType(allowedTypesArray, t);
  }, [allowedTypesArray, t]);

  const typesLabel = useMemo(() => {
    if (allowedTypesLabel) {
      return allowedTypesLabel;
    }
    if (
      allowedTypesArray.length === 1 &&
      allowedTypesArray[0].endsWith('/*') &&
      !allowedTypesArray[0].startsWith('*/')
    ) {
      return t(allowedTypesArray[0].replace('/*', 's'));
    }
  }, [allowedTypesArray, allowedTypesLabel, t]);

  const showSpinner = folders.length === 0 && areFoldersLoading;

  const isNothingExists =
    !myRootFolders.length &&
    !myRootFiles.length &&
    !organizationRootFolders.length &&
    !organizationRootFiles.length &&
    !sharedWithMeRootFolders.length &&
    !sharedWithMeRootFiles.length;

  const showNoResult = searchQuery !== '' && isNothingExists;

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

  const handleFolderToggle = useCallback(
    (folderId: string) => {
      const parentFolderIds = getParentFolderIdsFromFolderId(folderId)
        .slice(0, -2)
        .map((fid) => `${fid}/`);
      // selected now
      if (selectedFolderIds.some((fid) => parentFolderIds.includes(fid))) {
        setSelectedFilesIds((oldFileIds) =>
          !canAttachFiles
            ? []
            : oldFileIds.concat(
                files
                  .filter((file) =>
                    parentFolderIds.some((parentId) =>
                      file.id.startsWith(parentId),
                    ),
                  )
                  .map((f) => f.id),
              ),
        );
        setSelectedFolderIds((oldFolderIds) => {
          const parentSelectedFolderIds = selectedFolderIds.filter((fid) =>
            parentFolderIds.includes(fid),
          );
          return oldFolderIds
            .concat(
              folders
                .filter((folder) =>
                  parentSelectedFolderIds.some((parentId) =>
                    folder.id.startsWith(parentId),
                  ),
                )
                .map((f) => `${f.id}/`),
            )
            .filter(
              (oldFolderId) =>
                oldFolderId !== folderId &&
                !parentFolderIds.includes(oldFolderId),
            );
        });
      } else {
        setSelectedFolderIds((oldValues) => {
          if (oldValues.includes(folderId)) {
            return oldValues.filter((oldValue) => oldValue !== folderId);
          }
          setSelectedFilesIds((oldFileIds) =>
            !canAttachFiles
              ? []
              : oldFileIds.filter(
                  (oldFileId) => !oldFileId.startsWith(folderId),
                ),
          );
          return oldValues
            .filter((oldFolderId) => !oldFolderId.startsWith(folderId))
            .concat(folderId);
        });
      }
    },
    [canAttachFiles, files, folders, selectedFolderIds],
  );

  const handleItemCallback = useCallback(
    (
      eventId: string,
      data: unknown,
      options?: { deleteUnavailable?: boolean },
    ) => {
      if (typeof data !== 'string') {
        return;
      }

      switch (eventId) {
        case FileItemEventIds.Retry:
          dispatch(FilesActions.reuploadFile({ fileId: data }));
          break;
        case FileItemEventIds.Toggle:
          {
            const parentFolderIds = getParentFolderIdsFromFolderId(data)
              .slice(0, -1)
              .map((fid) => `${fid}/`);

            if (
              selectedFolderIds.some((fid) => parentFolderIds.includes(fid))
            ) {
              if (options?.deleteUnavailable) {
                setSelectedNoDeleteFilesIds((oldFileIds) =>
                  oldFileIds.concat(
                    files
                      .filter((file) =>
                        selectedNoDeleteFilesIds.some((parentId) =>
                          file.id.startsWith(parentId),
                        ),
                      )
                      .map((f) => f.id),
                  ),
                );
              }

              setSelectedFilesIds((oldFileIds) =>
                oldFileIds.concat(
                  files
                    .filter((file) =>
                      selectedFolderIds.some((parentId) =>
                        file.id.startsWith(parentId),
                      ),
                    )
                    .map((f) => f.id),
                ),
              );
              setSelectedFolderIds((oldFolderIds) => {
                return oldFolderIds
                  .concat(
                    folders
                      .filter((folder) =>
                        parentFolderIds.some((parentId) =>
                          folder.id.startsWith(parentId),
                        ),
                      )
                      .map((f) => `${f.id}/`),
                  )
                  .filter(
                    (oldFolderId) => !parentFolderIds.includes(oldFolderId),
                  );
              });
            }
            if (options?.deleteUnavailable) {
              setSelectedNoDeleteFilesIds((oldValues) => {
                if (oldValues.includes(data)) {
                  return oldValues.filter((oldValue) => oldValue !== data);
                }

                return oldValues.concat(data);
              });
            }

            setSelectedFilesIds((oldValues) => {
              if (oldValues.includes(data)) {
                return oldValues.filter((oldValue) => oldValue !== data);
              }

              return oldValues.concat(data);
            });
          }
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
    [dispatch, files, folders, selectedFolderIds, selectedNoDeleteFilesIds],
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
      allowedTypesArray,
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

    onClose([...selectedFolderIds, ...selectedFilesIds]);
  }, [
    allowedTypesArray,
    files,
    maximumAttachmentsAmount,
    onClose,
    selectedFilesIds,
    selectedFolderIds,
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
      if (canAttachFiles || forceShowSelectCheckBox) {
        setSelectedFilesIds((oldValues) =>
          oldValues.concat(selectedFiles.map((f) => f.id)),
        );
      }

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
    [canAttachFiles, dispatch, forceShowSelectCheckBox],
  );

  const handleDiscardSharedWithMeFolder = useCallback(
    (folderId: string) => {
      dispatch(
        ShareActions.discardSharedWithMe({
          resourceIds: [folderId],
          featureType: FeatureType.File,
          isFolder: true,
        }),
      );
    },
    [dispatch],
  );

  const handleDeleteMultipleFiles = useCallback(() => {
    if (!deletingFileIds.length && !deletingFolderIds.length) {
      return;
    }
    if (deletingFileIds.length) {
      const sharedWithMeFilesIds = sharedWithMeRootFiles
        .filter(({ id }) => deletingFileIds.includes(id))
        .map(({ id }) => id);

      if (sharedWithMeFilesIds.length) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: sharedWithMeFilesIds,
            featureType: FeatureType.File,
          }),
        );
      }
      dispatch(FilesActions.deleteFilesList({ fileIds: deletingFileIds }));
      if (selectedFilesIds === deletingFileIds) {
        setSelectedFilesIds([]);
      }
    }
    if (deletingFolderIds.length) {
      // TODO: implement
      // dispatch(FilesActions.deleteFolderList({ folderIds: deletingFolderIds }));
      const sharedWithMeFoldersIds = sharedWithMeRootFolders
        .filter(({ id }) => deletingFolderIds.includes(id))
        .map(({ id }) => id);
      if (sharedWithMeFoldersIds.length) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: sharedWithMeFoldersIds,
            featureType: FeatureType.File,
          }),
        );
      }
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
    sharedWithMeRootFiles,
    sharedWithMeRootFolders,
  ]);

  const handleDownloadMultipleFiles = useCallback(() => {
    if (!selectedFilesIds.length) {
      return;
    }

    dispatch(FilesActions.downloadFilesList({ fileIds: selectedFilesIds }));
  }, [dispatch, selectedFilesIds]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="file-manager-modal"
      containerClassName="flex flex-col gap-4 sm:w-[525px] w-full"
      dismissProps={{ outsidePressEvent: 'mousedown', outsidePress: true }}
    >
      <div className="flex flex-col gap-2 overflow-auto px-3 py-4 md:p-6">
        <div className="flex justify-between">
          <h2 id={headingId} className="text-base font-semibold">
            {headerLabel}
          </h2>
        </div>
        {(canAttachFiles || forceShowSelectCheckBox) && (
          <p id={descriptionId} data-qa="supported-attributes">
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
        )}

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
            <div className="flex min-h-[350px] flex-col divide-y divide-tertiary overflow-auto">
              {(isNothingExists || showNoResult) && (
                <div className="flex grow flex-col justify-center">
                  {showNoResult ? <NoResultsFound /> : <NoData />}
                </div>
              )}
              <FilesSectionWrapper
                name={t('Organization')}
                dataQa="organization-files"
                folders={organizationRootFolders}
                files={organizationRootFiles}
              >
                <div className="flex flex-col gap-1 overflow-auto">
                  {organizationRootFolders.map((folder) => {
                    return (
                      <Folder
                        key={folder.id}
                        searchTerm={searchQuery}
                        currentFolder={folder}
                        allFolders={folders}
                        highlightedFolders={highlightFolderIds}
                        isInitialRenameEnabled
                        newAddedFolderId={newFolderId}
                        loadingFolderIds={loadingFolderIds}
                        openedFoldersIds={openedFoldersIds}
                        allItems={files}
                        additionalItemData={{
                          selectedFilesIds,
                          selectedFolderIds,
                          canAttachFiles:
                            canAttachFiles || forceShowSelectCheckBox,
                        }}
                        itemComponent={(props) => (
                          <FileItem
                            {...props}
                            onEvent={(eventId, data) =>
                              handleItemCallback(eventId, data, {
                                deleteUnavailable: true,
                              })
                            }
                          />
                        )}
                        onClickFolder={handleFolderSelect}
                        onAddFolder={handleAddFolder}
                        onFileUpload={handleUploadFile}
                        onRenameFolder={handleRenameFolder}
                        skipFolderRenameValidation
                        onItemEvent={handleItemCallback}
                        withBorderHighlight={false}
                        featureType={FeatureType.File}
                        canSelectFolders={canAttachFolders}
                        showTooltip={showTooltip}
                        onSelectFolder={handleFolderToggle}
                      />
                    );
                  })}
                  {organizationRootFiles.map((file) => {
                    return (
                      <FileItem
                        key={file.id}
                        item={file}
                        level={0}
                        additionalItemData={{
                          selectedFolderIds,
                          selectedFilesIds,
                          canAttachFiles:
                            canAttachFiles || forceShowSelectCheckBox,
                        }}
                        onEvent={(eventId, data) =>
                          handleItemCallback(eventId, data, {
                            deleteUnavailable: true,
                          })
                        }
                      />
                    );
                  })}
                </div>
              </FilesSectionWrapper>

              <FilesSectionWrapper
                name={t('Shared with me')}
                dataQa="shared-with-me-files"
                folders={sharedWithMeRootFolders}
                files={sharedWithMeRootFiles}
              >
                <div className="flex flex-col gap-1 overflow-auto">
                  {sharedWithMeRootFolders.map((folder) => {
                    return (
                      <Folder
                        key={folder.id}
                        searchTerm={searchQuery}
                        currentFolder={folder}
                        allFolders={folders}
                        highlightedFolders={highlightFolderIds}
                        newAddedFolderId={newFolderId}
                        loadingFolderIds={loadingFolderIds}
                        openedFoldersIds={openedFoldersIds}
                        allItems={files}
                        additionalItemData={{
                          selectedFilesIds,
                          selectedFolderIds,
                          canAttachFiles:
                            canAttachFiles || forceShowSelectCheckBox,
                        }}
                        itemComponent={FileItem}
                        onClickFolder={handleFolderSelect}
                        onAddFolder={handleAddFolder}
                        onFileUpload={handleUploadFile}
                        onRenameFolder={handleRenameFolder}
                        skipFolderRenameValidation
                        onItemEvent={handleItemCallback}
                        withBorderHighlight={false}
                        featureType={FeatureType.File}
                        canSelectFolders={canAttachFolders}
                        showTooltip={showTooltip}
                        onSelectFolder={handleFolderToggle}
                        onDeleteFolder={handleDiscardSharedWithMeFolder}
                      />
                    );
                  })}
                  {sharedWithMeRootFiles.map((file) => {
                    return (
                      <FileItem
                        key={file.id}
                        item={file}
                        level={0}
                        additionalItemData={{
                          selectedFolderIds,
                          selectedFilesIds,
                          canAttachFiles:
                            canAttachFiles || forceShowSelectCheckBox,
                        }}
                        onEvent={handleItemCallback}
                      />
                    );
                  })}
                </div>
              </FilesSectionWrapper>

              <FilesSectionWrapper
                name={t('All files')}
                dataQa="all-files"
                folders={myRootFolders}
                files={myRootFiles}
              >
                <div className="flex flex-col gap-1 overflow-auto">
                  {myRootFolders.map((folder) => {
                    return (
                      <Folder
                        key={folder.id}
                        searchTerm={searchQuery}
                        currentFolder={folder}
                        allFolders={folders}
                        highlightedFolders={highlightFolderIds}
                        isInitialRenameEnabled
                        newAddedFolderId={newFolderId}
                        loadingFolderIds={loadingFolderIds}
                        openedFoldersIds={openedFoldersIds}
                        allItems={files}
                        additionalItemData={{
                          selectedFilesIds,
                          selectedFolderIds,
                          canAttachFiles:
                            canAttachFiles || forceShowSelectCheckBox,
                        }}
                        itemComponent={FileItem}
                        onClickFolder={handleFolderSelect}
                        onAddFolder={handleAddFolder}
                        onFileUpload={handleUploadFile}
                        onRenameFolder={handleRenameFolder}
                        skipFolderRenameValidation
                        onItemEvent={handleItemCallback}
                        withBorderHighlight={false}
                        featureType={FeatureType.File}
                        canSelectFolders={canAttachFolders}
                        showTooltip={showTooltip}
                        onSelectFolder={handleFolderToggle}
                      />
                    );
                  })}
                  {myRootFiles.map((file) => {
                    return (
                      <FileItem
                        key={file.id}
                        item={file}
                        level={0}
                        additionalItemData={{
                          selectedFolderIds,
                          selectedFilesIds,
                          canAttachFiles:
                            canAttachFiles || forceShowSelectCheckBox,
                        }}
                        onEvent={handleItemCallback}
                      />
                    );
                  })}
                </div>
              </FilesSectionWrapper>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-tertiary px-3 py-4 md:px-6 md:py-4">
        <div className="flex items-center justify-center gap-2">
          {selectedFilesIds.length > 0 && selectedFolderIds.length === 0 && (
            <button
              onClick={() => handleStartDeleteMultipleFiles()}
              disabled={!!selectedNoDeleteFilesIds.length}
              className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-secondary"
              data-qa="delete-files"
            >
              <Tooltip
                tooltip={
                  selectedNoDeleteFilesIds.length
                    ? t('It is forbidden to delete files from Organization')
                    : t('Delete files')
                }
                isTriggerClickable
              >
                <IconTrash size={24} />
              </Tooltip>
            </button>
          )}
          {selectedFilesIds.length > 0 && selectedFolderIds.length === 0 && (
            <button
              onClick={handleDownloadMultipleFiles}
              className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha  hover:text-accent-primary"
              data-qa="download-files"
            >
              <Tooltip tooltip={t('Download files')} isTriggerClickable>
                <IconDownload size={24} />
              </Tooltip>
            </button>
          )}
          {selectedFilesIds.length === 0 && selectedFolderIds.length === 0 && (
            <button
              onClick={handleNewFolder}
              className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha  hover:text-accent-primary"
              data-qa="new-folder"
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
            data-qa="upload-from-device"
          >
            {t('Upload from device')}
          </button>
          {customButtonLabel && (
            <button
              onClick={handleAttachFiles}
              className="button button-primary"
              disabled={
                selectedFilesIds.length === 0 && selectedFolderIds.length === 0
              }
              data-qa="attach-files"
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
          allowedTypes={allowedTypesArray}
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
              '?',
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
