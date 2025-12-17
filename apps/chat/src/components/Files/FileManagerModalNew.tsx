import { useId } from '@floating-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getDialFilesWithInvalidFileType,
  getShortExtensionsListFromMimeType,
} from '@/src/utils/app/file';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { MAX_FILE_SIZE_IN_BYTES } from '@/src/constants/file';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';
import { OperationLoaderModal } from '@/src/components/FileManager/OperationLoaderModal';

import {
  ButtonVariant,
  DialButton,
  DialFileAcceptType,
  DialFileManager,
  DialFileManagerActions,
  DialLoader,
} from '@epam/ai-dial-ui-kit';
import uniq from 'lodash-es/uniq';

interface Props {
  isOpen: boolean;
  initialSelectedFilesIds?: string[];
  allowedTypes?: string[];
  allowedTypesLabel?: string | null;
  maximumAttachmentsAmount?: number;
  headerLabel: string;
  customButtonLabel?: string;
  onClose: (result: boolean | string[]) => void;
  forceShowSelectCheckBox?: boolean;
  forceHideSelectFolders?: boolean;
}

export const FileManagerModalNew = ({
  isOpen,
  allowedTypes = [],
  allowedTypesLabel,
  initialSelectedFilesIds = [],
  headerLabel,
  customButtonLabel,
  maximumAttachmentsAmount = 0,
  forceShowSelectCheckBox,
  forceHideSelectFolders,
  onClose,
}: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.SideBar);

  const headingId = useId();
  const descriptionId = useId();

  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );
  const canAttachFolders =
    useAppSelector(ConversationsSelectors.selectCanAttachFolders) &&
    !forceHideSelectFolders;

  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);

  const { fullyChosenFolderIds: selectedFolderIds } = useAppSelector(
    FilesSelectors.selectChosenFolderIds,
  );
  const selectedFilesIds = useAppSelector(FilesSelectors.selectChosenItems);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const folderPaths = useMemo(
    () => new Set(folders.map((f) => f.id)),
    [folders],
  );

  const pathSelectionHandler = useCallback(
    (paths: Set<string>) => {
      setSelectedPaths(paths);
      paths.forEach((path) => {
        if (folderPaths.has(path)) {
          dispatch(FilesActions.setChosenFolder({ folderId: path }));
        } else {
          dispatch(FilesActions.setChosenFiles({ ids: [path] }));
        }
      });
    },
    [dispatch, folderPaths],
  );

  const initialSelectedFilesIdsRef = useRef<string[]>(initialSelectedFilesIds);

  useEffect(() => {
    initialSelectedFilesIdsRef.current = initialSelectedFilesIds;
  }, [initialSelectedFilesIds]);

  useEffect(() => {
    if (isOpen && initialSelectedFilesIdsRef.current.length) {
      dispatch(
        FilesActions.setChosenFilesAndFolders({
          ids: initialSelectedFilesIdsRef.current,
        }),
      );
    }
  }, [isOpen, dispatch]);

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

  const handleAttachFiles = useCallback(() => {
    const result: string[] = [];

    console.log(
      '🚀 ~ FileManagerModalNew ~ selectedFolderIds:',
      selectedFolderIds,
    );
    console.log(
      '🚀 ~ FileManagerModalNew ~ selectedFilesIds:',
      selectedFilesIds,
    );

    const selectedFiles = files.filter((file) =>
      selectedFilesIds.includes(file.id),
    );
    const filesWithIncorrectTypes = getDialFilesWithInvalidFileType(
      selectedFiles,
      allowedTypesArray,
    ).map((file) => file.id);
    console.log(
      '🚀 ~ FileManagerModalNew ~ filesWithIncorrectTypes:',
      filesWithIncorrectTypes,
    );

    if (canAttachFolders) {
      result.push(...selectedFolderIds);
    }
    result.push(
      ...selectedFilesIds.filter((id) => {
        if (filesWithIncorrectTypes.includes(id)) {
          return false;
        }

        return canAttachFolders
          ? !selectedFolderIds.some((folderId) => id.startsWith(folderId))
          : true;
      }),
    );
    console.log('🚀 ~ FileManagerModalNew ~ result:', result);

    onClose(uniq(result));
  }, [
    allowedTypesArray,
    canAttachFolders,
    files,
    onClose,
    selectedFilesIds,
    selectedFolderIds,
  ]);

  const {
    currentPath,
    setCurrentPath,
    areFilesLoading,
    areFoldersLoading,
    isAnyOperationInProgress,
    fileTreeItems,
    rootFolder,
    sharedByMePaths,
    isLoadingSearchListing,
    searchResultsUIKit,

    operationLoaderModal,

    bulkActionsToolbarOptions,
    treeOptions,
    fileMetadataPopupOptions,
    navigationPanelOptions,
    gridOptions,
    toolbarOptions,
    deleteConfirmationOptions,

    handleSearchFiles,
    handleDeleteFiles,
    handleDownloadFiles,
    handleTableFileClick,
    handleUploadFiles,
    handleCreateFolder,
    handleUploadArchive,
  } = useFileManager({
    actionLabelsOptions: {
      actionsByTab: {
        my_files: [
          DialFileManagerActions.Delete,
          DialFileManagerActions.Download,
          DialFileManagerActions.Rename,
        ],
        shared: [DialFileManagerActions.Download],
        organization: [DialFileManagerActions.Download],
      },
    },
  });

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="file-manager-modal"
      containerClassName="flex flex-col gap-4 w-full sm:w-[1200px] h-[min(800px,100vh)] !bg-layer-2"
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
    >
      <div className="flex h-full flex-col gap-5 overflow-auto px-3 py-4 md:p-6">
        <div className="flex flex-col gap-2">
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
        </div>

        <div className="flex w-full grow overflow-auto">
          <DialFileManager
            className="p-0"
            path={currentPath}
            onPathChange={setCurrentPath}
            selectedPaths={selectedPaths}
            onSelectedPathsChange={pathSelectionHandler}
            items={fileTreeItems}
            rootItem={rootFolder}
            filesLoading={areFilesLoading || areFoldersLoading}
            sharedByMePaths={sharedByMePaths}
            onSearchFiles={handleSearchFiles}
            searchInProgress={isLoadingSearchListing}
            searchResults={searchResultsUIKit}
            allowedFileTypes={allowedTypes as DialFileAcceptType[]}
            maxFileSize={MAX_FILE_SIZE_IN_BYTES}
            bulkActionsToolbarOptions={bulkActionsToolbarOptions}
            treeOptions={treeOptions}
            fileMetadataPopupOptions={fileMetadataPopupOptions}
            navigationPanelOptions={navigationPanelOptions}
            gridOptions={gridOptions}
            toolbarOptions={toolbarOptions}
            onDeleteFiles={handleDeleteFiles}
            onDownloadFiles={handleDownloadFiles}
            onTableFileClick={handleTableFileClick}
            deleteConfirmationOptions={deleteConfirmationOptions}
            onUploadFiles={handleUploadFiles}
            onCreateFolder={handleCreateFolder}
            onUploadArchive={handleUploadArchive}
          />
          {isAnyOperationInProgress && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay">
              <DialLoader size={48} ariaLabel={t('Processing files...')} />
            </div>
          )}
          {operationLoaderModal && (
            <OperationLoaderModal
              title={operationLoaderModal.title}
              text={operationLoaderModal.text}
              onCancel={operationLoaderModal.onCancel}
            />
          )}
        </div>

        <div className="flex justify-end">
          <DialButton
            onClick={handleAttachFiles}
            variant={ButtonVariant.Primary}
            label={customButtonLabel ?? t('Attach')}
            disabled={
              selectedFilesIds.length === 0 && selectedFolderIds.length === 0
            }
          />
        </div>
      </div>
    </Modal>
  );
};
