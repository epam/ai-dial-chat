import { useId } from '@floating-ui/react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  formatFileSize,
  getDialFilesWithInvalidFileType,
  getShortExtensionsListFromMimeType,
} from '@/src/utils/app/file';

import { FileSourceType } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { ToastType } from '@/src/types/toasts';
import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { FilesActions } from '@/src/store/files/files.reducers';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';
import { FilesUploadingModal } from '@/src/components/FileManager/FilesUploadingModal';
import { OperationLoaderModal } from '@/src/components/FileManager/OperationLoaderModal';

import {
  ButtonVariant,
  DialButton,
  DialFileAcceptType,
  DialFileManager,
  DialFileManagerActions,
  DialFileManagerTabs,
  DialLoader,
} from '@epam/ai-dial-ui-kit';

interface Props {
  isOpen: boolean;
  selectedFilesIds?: string[];
  allowedTypes?: string[];
  allowedTypesLabel?: string | null;
  maximumAttachmentsAmount?: number;
  headerLabel: string;
  customButtonLabel?: string;
  onClose: (result: boolean | string[]) => void;
  forceShowSelectCheckBox?: boolean;
  forceHideSelectFolders?: boolean;
  sourceFilters?: Set<FileSourceType>;
  warningMessage?: string;
  maxSelectableFileSize?: number;
}

export const FileManagerModal = memo(
  ({
    isOpen,
    allowedTypes = [],
    allowedTypesLabel,
    selectedFilesIds: previousSelectedFilesIds = [],
    headerLabel,
    customButtonLabel,
    maximumAttachmentsAmount = 0,
    forceShowSelectCheckBox,
    forceHideSelectFolders,
    onClose,
    sourceFilters,
    warningMessage,
    maxSelectableFileSize,
  }: Props) => {
    const dispatch = useAppDispatch();
    const { t } = useTranslation(Translation.Chat);

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

    const folderPaths = useMemo(
      () => new Set(folders.map((f) => f.id)),
      [folders],
    );

    const prevSelectionRef = useRef<Set<string>>(new Set());

    const pathSelectionHandler = useCallback(
      (paths: Set<string>) => {
        const prev = prevSelectionRef.current;
        const next = new Set(paths);

        const added = [...next].filter((id) => !prev.has(id));
        const removed = [...prev].filter((id) => !next.has(id));

        prevSelectionRef.current = next;

        for (const id of added) {
          if (folderPaths.has(id)) {
            dispatch(FilesActions.setChosenFolder({ folderId: id }));
          } else {
            dispatch(FilesActions.setChosenFiles({ ids: [id] }));
          }
        }

        for (const id of removed) {
          if (folderPaths.has(id)) {
            dispatch(FilesActions.setChosenFolder({ folderId: id }));
          } else {
            dispatch(FilesActions.setChosenFiles({ ids: [id] }));
          }
        }
      },
      [dispatch, folderPaths],
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
      const accumulatedIds = new Set<string>(previousSelectedFilesIds);

      const selectedFiles = files.filter((file) =>
        selectedFilesIds.includes(file.id),
      );

      const invalidFileIds = new Set(
        getDialFilesWithInvalidFileType(selectedFiles, allowedTypesArray).map(
          (file) => file.id,
        ),
      );

      if (invalidFileIds.size > 0) {
        dispatch(
          UIActions.showToast({
            type: ToastType.Info,
            title: t('Unsupported files skipped'),
            message: t(
              'Some files in the selected folder(-s) weren’t attached because their type isn’t supported.',
            ),
          }),
        );
      }

      if (canAttachFolders) {
        selectedFolderIds.forEach((folderId) => {
          accumulatedIds.add(folderId);
        });
      }

      selectedFilesIds.forEach((fileId) => {
        if (invalidFileIds.has(fileId)) {
          return;
        }

        if (
          canAttachFolders &&
          selectedFolderIds.some((folderId) => fileId.startsWith(folderId))
        ) {
          return;
        }

        accumulatedIds.add(fileId);
      });

      if (accumulatedIds.size > maximumAttachmentsAmount) {
        dispatch(
          UIActions.showToast({
            type: ToastType.Error,
            title: t('Too many files selected'),
            message: t(
              'You selected {{count}} files, including previously attached ones. You can attach up to {{limit}} files.',
              {
                count: accumulatedIds.size,
                limit: maximumAttachmentsAmount,
              },
            ),
          }),
        );
        return;
      }

      onClose(Array.from(accumulatedIds));
    }, [
      allowedTypesArray,
      canAttachFolders,
      dispatch,
      files,
      previousSelectedFilesIds,
      maximumAttachmentsAmount,
      onClose,
      selectedFilesIds,
      selectedFolderIds,
      t,
    ]);

    const availableTabs = useMemo(() => {
      if (!sourceFilters) return undefined;

      const mapping: Record<FileSourceType, DialFileManagerTabs | undefined> = {
        [FileSourceType.MY_FILES]: DialFileManagerTabs.MyFiles,
        [FileSourceType.SHARED_WITH_ME]: DialFileManagerTabs.Shared,
        [FileSourceType.PUBLIC]: DialFileManagerTabs.Organization,
        [FileSourceType.REVIEW_FILES]: undefined,
      };

      return new Set(
        Array.from(sourceFilters)
          .map((s) => mapping[s])
          .filter((t): t is DialFileManagerTabs => Boolean(t)),
      );
    }, [sourceFilters]);

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
      isRenaming,

      operationLoaderModalOptions,
      filesUploadingModalOptions,

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
      handleMoveFiles,
      handleRenameValidation,
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
      toolbarOptions: {
        newButtonVariant: ButtonVariant.Secondary,
      },
      availableTabs,
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
        <div className="flex h-full flex-col overflow-auto px-3 py-4 md:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <h2
                id={headingId}
                className="text-base font-semibold"
                data-qa="modal-title"
              >
                {headerLabel}
              </h2>
            </div>
            {(canAttachFiles || forceShowSelectCheckBox) && (
              <p id={descriptionId} data-qa="supported-attributes">
                {t(
                  'Maximum size: {{maxSelectableFileSize}}. Supported types: {{allowedExtensions}}.',
                  {
                    maxSelectableFileSize: maxSelectableFileSize
                      ? formatFileSize(maxSelectableFileSize)
                      : '512 MB',
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
            {warningMessage && <p>{warningMessage}</p>}
          </div>

          <div
            className="flex w-full grow overflow-auto"
            data-qa="file-manager"
          >
            <DialFileManager
              className="px-0 pb-5"
              path={currentPath}
              onPathChange={setCurrentPath}
              onSelectedPathsChange={pathSelectionHandler}
              items={fileTreeItems}
              rootItem={rootFolder}
              filesLoading={areFilesLoading || areFoldersLoading}
              sharedByMePaths={sharedByMePaths}
              onSearchFiles={handleSearchFiles}
              searchInProgress={isLoadingSearchListing}
              searchResults={searchResultsUIKit}
              allowedFileTypes={allowedTypes as DialFileAcceptType[]}
              maxSelectableFileSize={maxSelectableFileSize}
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
              onMoveToFiles={handleMoveFiles}
              onRenameValidate={handleRenameValidation}
            />
            {isAnyOperationInProgress && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay">
                <DialLoader size={48} ariaLabel={t('Processing files...')} />
              </div>
            )}
            {operationLoaderModalOptions && !isRenaming && (
              <OperationLoaderModal {...operationLoaderModalOptions} />
            )}
            {filesUploadingModalOptions && (
              <FilesUploadingModal {...filesUploadingModalOptions} />
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
  },
);
FileManagerModal.displayName = 'FileManagerModal';
