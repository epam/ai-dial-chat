import { useId } from '@floating-ui/react';
import { IconDownload, IconTrashX } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useHandleFileFolders } from '@/src/hooks/useHandleFileFolders';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getDialFilesWithInvalidFileType,
  getShortExtensionsListFromMimeType,
} from '@/src/utils/app/file';
import {
  getParentFolderIdsFromFolderId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import { areEntitiesBucketsTheSame, getFileRootId } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
  defaultMyItemsFilters,
} from '@/src/utils/app/search';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { DialFile, FileSourceType } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { FilesActions, ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  FilesSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';
import {
  ORGANIZATION_SECTION_NAME,
  SHARED_WITH_ME_SECTION_NAME,
} from '@/src/constants/sections';

import { HiddenItemsToggler } from '@/src/components/Buttons/HiddenItemsToggler';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { Modal } from '@/src/components/Common/Modal';
import { NoData } from '@/src/components/Common/NoData';
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { Folder } from '@/src/components/Folder/Folder';

import { FileItem, FileItemEventIds } from './FileItem';
import { FilesSectionWrapper } from './FilesSectionWrapper';
import { PreUploadDialog } from './PreUploadModal';
import { ReviewBucketFilesSection } from './ReviewBucketFilesSection';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import uniq from 'lodash-es/uniq';

const sectionWrapperToggleClasses = 'sticky top-0 z-10 bg-layer-3';

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
  sourceFilters?: Set<FileSourceType>;
  warningMessage?: string;
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
  sourceFilters,
  warningMessage,
}: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const headingId = useId();
  const descriptionId = useId();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUnshare, setIsUnshare] = useState(false);
  const [areHiddenItemsVisible, setAreHiddenItemsVisible] = useState(false);
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
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
  const organizationRootFiles = useAppSelector((state) =>
    FilesSelectors.selectFilteredFiles(
      state,
      PublishedWithMeFilter,
      searchQuery,
    ),
  );
  const sharedWithMeRootFiles = useAppSelector((state) =>
    FilesSelectors.selectFilteredFiles(state, SharedWithMeFilters, searchQuery),
  );

  const myRootFolders = useAppSelector((state) =>
    FilesSelectors.selectFilteredFolders(
      state,
      defaultMyItemsFilters,
      searchQuery,
      areHiddenItemsVisible,
    ),
  );
  const organizationRootFolders = useAppSelector((state) =>
    FilesSelectors.selectFilteredFolders(
      state,
      PublishedWithMeFilter,
      searchQuery,
      areHiddenItemsVisible,
    ),
  );
  const sharedWithMeRootFolders = useAppSelector((state) =>
    FilesSelectors.selectFilteredFolders(
      state,
      SharedWithMeFilters,
      searchQuery,
      areHiddenItemsVisible,
    ),
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
  const lastRenamedParentFolder = useAppSelector(
    FilesSelectors.selectLastRenamedParentFolder,
  );
  const {
    partialChosenFolderIds: partiallySelectedFolderIds,
    fullyChosenFolderIds: selectedFolderIds,
  } = useAppSelector(FilesSelectors.selectChosenFolderIds);
  const selectedFilesIds = useAppSelector(FilesSelectors.selectChosenItems);

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState<string | undefined>(
    getFileRootId(),
  );
  const [isUploadFromDeviceOpened, setIsUploadFromDeviceOpened] =
    useState(false);
  const [deletingFileIds, setDeletingFileIds] = useState<string[]>([]);
  const [deletingFolderIds, setDeletingFolderIds] = useState<string[]>([]);

  const handleSelectFiles = useCallback(
    (ids: string[]) => {
      dispatch(FilesActions.setChosenFiles({ ids }));
    },
    [dispatch],
  );

  const handleSelectFolder = useCallback(
    (folderId: string) => {
      dispatch(FilesActions.setChosenFolder({ folderId }));
    },
    [dispatch],
  );

  useEffect(() => {
    if (lastRenamedParentFolder?.newId) {
      setOpenedFoldersIds((prev) =>
        prev.map((id) => {
          if (id === lastRenamedParentFolder.oldId)
            return lastRenamedParentFolder.newId;
          if (id.startsWith(`${lastRenamedParentFolder.oldId}/`))
            return updateMovedFolderId(
              lastRenamedParentFolder.oldId,
              lastRenamedParentFolder.newId,
              id,
            );
          return id;
        }),
      );
      dispatch(FilesActions.resetLastRenamedParentFolder());
    }
  }, [dispatch, lastRenamedParentFolder]);

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
      dispatch(FilesActions.resetAllFoldersStatus());
      dispatch(FilesActions.getFilesWithFolders({}));
      dispatch(FilesActions.resetNewFolderId());
    }

    return () => {
      dispatch(FilesActions.resetChosenFiles());
    };
  }, [dispatch, isOpen]);

  useEffect(() => {
    if (isOpen && initialSelectedFilesIds.length) {
      dispatch(
        FilesActions.setChosenFilesAndFolders({ ids: initialSelectedFilesIds }),
      );
    }
  }, [isOpen, initialSelectedFilesIds, dispatch]);

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
        case FileItemEventIds.Toggle:
          handleSelectFiles([data]);
          break;
        case FileItemEventIds.Retry:
          dispatch(FilesActions.reuploadFile({ fileId: data }));
          break;
        case FileItemEventIds.Cancel:
          dispatch(FilesActions.deleteFile({ fileId: data }));
          break;
        case FileItemEventIds.Delete:
          setDeletingFileIds([data]);
          break;
        case FileItemEventIds.Unshare:
          setDeletingFileIds([data]);
          setIsUnshare(true);
          break;
        default:
          break;
      }
    },
    [dispatch, handleSelectFiles],
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
        ),
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
          `You're trying to upload files with incorrect type: {{incorrectTypeFileNames}}`,
          {
            incorrectTypeFileNames: filesWithIncorrectTypes.join(', '),
          },
        ),
      );
      return;
    }

    const result: string[] = [];

    if (canAttachFolders) {
      result.push(...selectedFolderIds);
    }
    result.push(
      ...selectedFilesIds.filter((id) =>
        canAttachFolders
          ? !selectedFolderIds.some((folderId) => id.startsWith(folderId))
          : true,
      ),
    );

    onClose(uniq(result));
  }, [
    allowedTypesArray,
    canAttachFolders,
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
        handleSelectFiles(selectedFiles.map((f) => f.id));
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
    [canAttachFiles, dispatch, handleSelectFiles, forceShowSelectCheckBox],
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
        dispatch(FilesActions.resetChosenFiles());
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
    }
  }, [
    deletingFileIds,
    deletingFolderIds,
    dispatch,
    selectedFilesIds,
    sharedWithMeRootFiles,
    sharedWithMeRootFolders,
  ]);

  const handleDownloadMultipleFiles = useCallback(() => {
    if (!selectedFilesIds.length) {
      return;
    }

    dispatch(FilesActions.downloadFilesList({ fileIds: selectedFilesIds }));
  }, [dispatch, selectedFilesIds]);

  const handleToggleHiddenItems = useCallback(
    () => setAreHiddenItemsVisible((prev) => !prev),
    [],
  );

  const additionalItemData: AdditionalItemData = useMemo(
    () => ({
      selectedFilesIds,
      selectedFolderIds,
      partialSelectedFolderIds: partiallySelectedFolderIds,
      canAttachFiles: canAttachFiles || forceShowSelectCheckBox,
    }),
    [
      canAttachFiles,
      partiallySelectedFolderIds,
      selectedFilesIds,
      selectedFolderIds,
      forceShowSelectCheckBox,
    ],
  );

  const firstPublicationResourceReviewUrl =
    selectedPublication?.resources.at(0)?.reviewUrl;
  const someReviewBucketFileSelected =
    !!firstPublicationResourceReviewUrl &&
    selectedFilesIds.some((id) =>
      areEntitiesBucketsTheSame(id, firstPublicationResourceReviewUrl),
    );
  const somePublicFileSelected = selectedFilesIds.some((id) =>
    isEntityIdPublic({ id }),
  );
  const isDeleteDisabled =
    somePublicFileSelected || someReviewBucketFileSelected;

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="file-manager-modal"
      containerClassName="flex flex-col gap-4 sm:w-[525px] w-full"
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
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
              'Maximum size: 512 MB. Supported types: {{allowedExtensions}}.',
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
              t('Up to {{maxAttachmentsAmount}} files.', {
                maxAttachmentsAmount: maximumAttachmentsAmount,
              })}
          </p>
        )}

        <ErrorMessage
          error={warningMessage || errorMessage}
          type={warningMessage ? 'warning' : 'error'}
        />

        {showSpinner ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size={30} />
          </div>
        ) : (
          <div className="group/modal flex flex-col gap-2 overflow-auto">
            <input
              name="titleInput"
              placeholder={t('Search files')}
              type="text"
              onChange={handleSearch}
              className="m-0 w-full rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
              data-qa="search"
            ></input>
            <div className="flex min-h-[350px] flex-col divide-y divide-tertiary overflow-auto">
              {(isNothingExists || showNoResult) && (
                <div className="flex grow flex-col justify-center">
                  {showNoResult ? <NoResultsFound /> : <NoData />}
                </div>
              )}
              <FilesSectionWrapper
                name={ORGANIZATION_SECTION_NAME}
                dataQa="organization-files"
                folders={organizationRootFolders}
                files={organizationRootFiles}
                sourceType={FileSourceType.PUBLIC}
                filters={sourceFilters}
                toggleClassName={sectionWrapperToggleClasses}
              >
                <div className="flex flex-col gap-1 overflow-auto">
                  {organizationRootFolders.map((folder) => {
                    return (
                      <Folder
                        showTechnicalFolders={areHiddenItemsVisible}
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
                        additionalItemData={additionalItemData}
                        itemComponent={(props) => (
                          <FileItem {...props} onEvent={handleItemCallback} />
                        )}
                        onClickFolder={handleFolderSelect}
                        onAddFolder={handleAddFolder}
                        onFileUpload={handleUploadFile}
                        onRenameFolder={handleRenameFolder}
                        skipFolderRenameValidation
                        onItemEvent={handleItemCallback}
                        withBorderHighlight={false}
                        featureType={FeatureType.File}
                        canSelectFolders={canAttachFolders || canAttachFiles}
                        showTooltip={showTooltip}
                        onSelectFolder={handleSelectFolder}
                        onShowError={setErrorMessage}
                      />
                    );
                  })}
                  {organizationRootFiles.map((file) => {
                    return (
                      <FileItem
                        key={file.id}
                        item={file}
                        level={0}
                        additionalItemData={additionalItemData}
                        onEvent={handleItemCallback}
                      />
                    );
                  })}
                </div>
              </FilesSectionWrapper>

              <FilesSectionWrapper
                name={SHARED_WITH_ME_SECTION_NAME}
                dataQa="shared-with-me-files"
                folders={sharedWithMeRootFolders}
                files={sharedWithMeRootFiles}
                sourceType={FileSourceType.SHARED_WITH_ME}
                filters={sourceFilters}
                toggleClassName={sectionWrapperToggleClasses}
              >
                <div className="flex flex-col gap-1 overflow-auto">
                  {sharedWithMeRootFolders.map((folder) => {
                    return (
                      <Folder
                        showTechnicalFolders={areHiddenItemsVisible}
                        key={folder.id}
                        searchTerm={searchQuery}
                        currentFolder={folder}
                        allFolders={folders}
                        highlightedFolders={highlightFolderIds}
                        newAddedFolderId={newFolderId}
                        loadingFolderIds={loadingFolderIds}
                        openedFoldersIds={openedFoldersIds}
                        allItems={files}
                        additionalItemData={additionalItemData}
                        itemComponent={FileItem}
                        onClickFolder={handleFolderSelect}
                        onAddFolder={handleAddFolder}
                        onFileUpload={handleUploadFile}
                        onRenameFolder={handleRenameFolder}
                        skipFolderRenameValidation
                        onItemEvent={handleItemCallback}
                        withBorderHighlight={false}
                        featureType={FeatureType.File}
                        canSelectFolders={canAttachFolders || canAttachFiles}
                        showTooltip={showTooltip}
                        onSelectFolder={handleSelectFolder}
                        onUnshareFolder={handleDiscardSharedWithMeFolder}
                        onShowError={setErrorMessage}
                      />
                    );
                  })}
                  {sharedWithMeRootFiles.map((file) => {
                    return (
                      <FileItem
                        key={file.id}
                        item={file}
                        level={0}
                        additionalItemData={additionalItemData}
                        onEvent={handleItemCallback}
                      />
                    );
                  })}
                </div>
              </FilesSectionWrapper>

              <ReviewBucketFilesSection
                searchQuery={searchQuery}
                highlightFolderIds={highlightFolderIds}
                additionalItemData={{
                  selectedFilesIds,
                  selectedFolderIds,
                  canAttachFiles: canAttachFiles || forceShowSelectCheckBox,
                }}
                openedFoldersIds={openedFoldersIds}
                onItemEvent={handleItemCallback}
                onClickFolder={handleFolderSelect}
                canAttachFolders={canAttachFolders}
                onToggleFolder={handleSelectFolder}
              />

              <FilesSectionWrapper
                name={t('All files')}
                dataQa="all-files"
                folders={myRootFolders}
                files={myRootFiles}
                sourceType={FileSourceType.MY_FILES}
                filters={sourceFilters}
                toggleClassName={sectionWrapperToggleClasses}
              >
                <div className="flex flex-col gap-1 overflow-auto">
                  {myRootFolders.map((folder) => {
                    return (
                      <Folder
                        showTechnicalFolders={areHiddenItemsVisible}
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
                        additionalItemData={additionalItemData}
                        itemComponent={FileItem}
                        onClickFolder={handleFolderSelect}
                        onAddFolder={handleAddFolder}
                        onFileUpload={handleUploadFile}
                        onRenameFolder={handleRenameFolder}
                        skipFolderRenameValidation
                        onItemEvent={handleItemCallback}
                        withBorderHighlight={false}
                        featureType={FeatureType.File}
                        canSelectFolders={canAttachFolders || canAttachFiles}
                        showTooltip={showTooltip}
                        onSelectFolder={handleSelectFolder}
                        onShowError={setErrorMessage}
                      />
                    );
                  })}
                  {myRootFiles.map((file) => {
                    return (
                      <FileItem
                        key={file.id}
                        item={file}
                        level={0}
                        additionalItemData={additionalItemData}
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
          {selectedFilesIds.length > 0 && (
            <button
              onClick={handleStartDeleteMultipleFiles}
              disabled={isDeleteDisabled}
              className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-secondary"
              data-qa="delete-files"
            >
              <Tooltip
                tooltip={t(
                  somePublicFileSelected
                    ? 'It is forbidden to delete files from Organization'
                    : someReviewBucketFileSelected
                      ? 'It is forbidden to delete files from the "Review files" section'
                      : 'Delete files',
                )}
                isTriggerClickable
              >
                <IconTrashX size={24} />
              </Tooltip>
            </button>
          )}
          {selectedFilesIds.length > 0 && (
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
              <Tooltip tooltip={t('Create new folder')} isTriggerClickable>
                <FolderPlus height={24} width={24} />
              </Tooltip>
            </button>
          )}
          <HiddenItemsToggler
            onClick={handleToggleHiddenItems}
            areItemsVisible={areHiddenItemsVisible}
          />
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
            'Confirm ',
            isUnshare ? 'unsharing ' : 'deleting ',
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
        description={t(
          [
            'Are you sure that you want to ',
            isUnshare ? 'unshare ' : 'delete ',
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
        )}
        confirmLabel={t(isUnshare ? 'Unshare' : 'Delete')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          if (result) {
            handleDeleteMultipleFiles();
          }
          setDeletingFileIds([]);
          setDeletingFolderIds([]);
          setIsUnshare(false);
        }}
      />
    </Modal>
  );
};
