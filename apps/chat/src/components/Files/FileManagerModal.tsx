import { useId } from '@floating-ui/react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';
import { UseFileManagerActionLabelsOptions } from '@/src/hooks/useFileManagerActionLabels';
import { useReviewBucket } from '@/src/hooks/useReviewBucket';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  formatFileSize,
  getDialFilesWithInvalidFileType,
  getShortExtensionsListFromMimeType,
  isAllowedMimeType,
} from '@/src/utils/app/file';
import { isParentFolderSelected } from '@/src/utils/app/folders';
import { isHiddenPath } from '@/src/utils/app/search';

import { DialFile, FileSourceType } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { ToastType } from '@/src/types/toasts';
import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { FilesActions } from '@/src/store/files/files.reducers';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';
import { FilesUploadingModal } from '@/src/components/FileManager/FilesUploadingModal';
import { OperationLoaderModal } from '@/src/components/FileManager/OperationLoaderModal';

import { FolderInterface } from '@epam/ai-dial-shared';
import {
  ButtonVariant,
  DialFileAcceptType,
  DialFileManager,
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
  DialLoader,
  DialPrimaryButton,
  FileManagerGridRow,
} from '@epam/ai-dial-ui-kit';

interface Props {
  isOpen: boolean;
  initialPath?: string;
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
  additionalFilesAndFolders?: {
    files: DialFile[];
    folders?: FolderInterface[];
  };
  isPreUploadOpen?: boolean;
}

export const FileManagerModal = memo(
  ({
    isOpen,
    initialPath,
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
    additionalFilesAndFolders,
    isPreUploadOpen,
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

    const handleOnCloseFilesModal = useCallback(
      (result: boolean | string[]) => {
        dispatch(FilesActions.resetAllFoldersStatus());
        onClose(result);
      },
      [dispatch, onClose],
    );

    const pathSelectionHandler = useCallback(
      (paths: Set<string>) => {
        const prev = prevSelectionRef.current;
        const next = new Set(paths);

        const added = [...next].filter((id) => !prev.has(id));
        const removed = [...prev].filter((id) => !next.has(id));

        const filteredNext = new Set(
          [...next].filter((id) => !isHiddenPath(id)),
        );
        prevSelectionRef.current = filteredNext;

        for (const id of added) {
          if (isHiddenPath(id)) continue;

          if (folderPaths.has(id)) {
            dispatch(
              FilesActions.addChosenFolder({
                folderId: id,
              }),
            );
          } else {
            dispatch(FilesActions.addChosenFiles({ ids: [id] }));
          }
        }

        for (const id of removed) {
          if (folderPaths.has(id)) {
            dispatch(FilesActions.removeChosenFolder({ folderId: id }));
          } else {
            dispatch(FilesActions.removeChosenFiles({ ids: [id] }));
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
        return [t(ChatI18nKeys.all)];
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

    const getDisabledTooltip = useCallback(
      (row: FileManagerGridRow) => {
        return isHiddenPath(row.path)
          ? t(ChatI18nKeys.AttachingHiddenFilesNotAllowed)
          : undefined;
      },
      [t],
    );

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
      const hiddenFilesIds = new Set(
        selectedFiles
          .filter((file) => isHiddenPath(file.id))
          .map(({ id }) => id),
      );

      if (invalidFileIds.size > 0) {
        dispatch(
          UIActions.showToast({
            type: ToastType.Info,
            title: t(ChatI18nKeys.UnsupportedFilesSkipped),
            message: t(ChatI18nKeys.UnsupportedFilesDescription),
          }),
        );
      }

      if (canAttachFolders) {
        selectedFolderIds.forEach((folderId) => {
          if (
            !isParentFolderSelected({
              currentFolderId: folderId,
              selectedFolderIds: selectedFolderIds.filter(
                (id) => id !== folderId,
              ),
            })
          ) {
            accumulatedIds.add(folderId);
          }
        });
      }

      selectedFilesIds.forEach((fileId) => {
        if (invalidFileIds.has(fileId) || hiddenFilesIds.has(fileId)) {
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
            title: t(ChatI18nKeys.TooManyFilesSelected),
            message: t(ChatI18nKeys.TooManyFilesDescription, {
              count: accumulatedIds.size,
              limit: maximumAttachmentsAmount,
            }),
          }),
        );
        return;
      }

      handleOnCloseFilesModal(Array.from(accumulatedIds));
    }, [
      allowedTypesArray,
      canAttachFolders,
      dispatch,
      files,
      previousSelectedFilesIds,
      maximumAttachmentsAmount,
      handleOnCloseFilesModal,
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
        [FileSourceType.REVIEW_FILES]: DialFileManagerTabs.Review,
      };

      return new Set(
        Array.from(sourceFilters)
          .map((s) => mapping[s])
          .filter((t): t is DialFileManagerTabs => Boolean(t)),
      );
    }, [sourceFilters]);

    const reviewBucket = useReviewBucket();

    const actionLabelsOptions = useMemo<UseFileManagerActionLabelsOptions>(
      () => ({
        actionsByTab: {
          my_files: [
            DialFileManagerActions.Delete,
            DialFileManagerActions.Download,
            DialFileManagerActions.Rename,
          ],
          shared: [DialFileManagerActions.Download],
          organization: [DialFileManagerActions.Download],
          review: [DialFileManagerActions.Download],
        },
      }),
      [],
    );

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
      toolbarOptions,
      deleteConfirmationOptions,
      conflictResolutionPopupOptions,

      handleSearchFiles,
      handleDeleteFiles,
      handleDownloadFiles,
      handleTableFileClick,
      handleUploadFiles,
      handleCreateFolder,
      handleUploadArchive,
      handleMoveFiles,
      handleRenameValidation,
      sharedWithMeIds,

      uploadEnabled,
      gridOptions,
      emptyStateTitle,
      emptyStateDescription,
    } = useFileManager({
      actionLabelsOptions,
      toolbarOptions: {
        newButtonVariant: ButtonVariant.Secondary,
      },
      availableTabs,
      reviewBucket,
      additionalFilesAndFolders,
      initialPath,
    });

    const mergedGridOptions = useMemo(
      () => ({
        ...gridOptions,
        additionalGridOptions: {
          ...gridOptions.additionalGridOptions,
          rowSelection: {
            mode: 'multiRow' as const,
            isRowSelectable: (node: { data?: FileManagerGridRow | null }) => {
              const row = node.data;
              if (!row) return true;

              // Disable hidden files/folders and items inside hidden folders.
              if (isHiddenPath(row.path)) return false;

              // Replicate the UI kit's internal type/size disabled check so
              // those rows stay non-selectable when we override rowSelection.
              if (row.nodeType !== DialFileNodeType.FOLDER) {
                if (
                  row.contentType &&
                  !allowedTypes.includes('*/*') &&
                  allowedTypes.length > 0 &&
                  !isAllowedMimeType(allowedTypes, row.contentType)
                ) {
                  return false;
                }
                if (
                  maxSelectableFileSize != null &&
                  row.contentLength != null &&
                  row.contentLength > maxSelectableFileSize
                ) {
                  return false;
                }
              }

              return true;
            },
          },
        },
      }),
      [allowedTypes, gridOptions, maxSelectableFileSize],
    );

    return (
      <Modal
        portalId="theme-main"
        state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
        onClose={() => handleOnCloseFilesModal(false)}
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
                {t(ChatI18nKeys.MaxSizeSupportedTypes, {
                  maxSelectableFileSize: maxSelectableFileSize
                    ? formatFileSize(maxSelectableFileSize)
                    : '512 MB',
                  allowedExtensions:
                    typesLabel ||
                    allowedExtensions.join(', ') ||
                    'no available extensions',
                })}
                &nbsp;
                {maximumAttachmentsAmount !== Number.MAX_SAFE_INTEGER &&
                  !!maximumAttachmentsAmount &&
                  t(ChatI18nKeys.UpToFiles, {
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
              className="bg-layer-2 px-0 pb-5"
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
              gridOptions={mergedGridOptions}
              toolbarOptions={toolbarOptions}
              onDeleteFiles={handleDeleteFiles}
              onDownloadFiles={handleDownloadFiles}
              onTableFileClick={handleTableFileClick}
              deleteConfirmationOptions={deleteConfirmationOptions}
              conflictResolutionPopupOptions={conflictResolutionPopupOptions}
              onUploadFiles={handleUploadFiles}
              onCreateFolder={handleCreateFolder}
              onUploadArchive={handleUploadArchive}
              onMoveToFiles={handleMoveFiles}
              onRenameValidate={handleRenameValidation}
              onCreateFolderValidate={handleRenameValidation}
              sharedWithMeIds={sharedWithMeIds}
              uploadEnabled={uploadEnabled}
              getDisabledTooltip={getDisabledTooltip}
              emptyStateTitle={emptyStateTitle}
              emptyStateDescription={emptyStateDescription}
              hideSearchPathItemName
              autoSelectUploadedItems
              initialUploadFilesOpen={
                isPreUploadOpen &&
                !areFilesLoading &&
                !areFoldersLoading &&
                !isAnyOperationInProgress
              }
            />
            {isAnyOperationInProgress && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay">
                <DialLoader
                  size={48}
                  ariaLabel={t(ChatI18nKeys.ProcessingFiles)}
                />
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
            <DialPrimaryButton
              onClick={handleAttachFiles}
              label={customButtonLabel ?? t(ChatI18nKeys.Attach)}
              disabled={
                (selectedFilesIds.length === 0 &&
                  selectedFolderIds.length === 0) ||
                isAnyOperationInProgress ||
                areFilesLoading ||
                areFoldersLoading
              }
            />
          </div>
        </div>
      </Modal>
    );
  },
);
FileManagerModal.displayName = 'FileManagerModal';
