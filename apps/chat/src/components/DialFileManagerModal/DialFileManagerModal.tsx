import {
  isMimeTypeAllowed,
  mimeTypesToExtensionLabels,
} from '@epam/ai-dial-attachment-input';
import {
  DialFileManager,
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
  DialLoader,
  DialPopup,
  DialPrimaryButton,
  GridSelectionMode,
  NOT_ALLOWED_SYMBOLS_REGEXP,
  NotificationVariant,
  PopupSize,
  type DialFile,
  type FileManagerGridRow,
  useDialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { useDialFileManager } from '../../hooks/files/useDialFileManager';
import {
  mimeTypesToAttachmentExtensionLabels,
  mimeTypesToDialFileAcceptTypes,
} from '../../utils/attachment-types';
import { isHiddenPath } from '../../utils/file-path';
import { formatFileSize } from '../../utils/string-utils';
import type { AttachResult } from './types/attach-result';
import { FileUploadStatus } from './types/upload';
import UploadProgressModal from './UploadProgressModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (result: AttachResult) => void;
  bucket: string;
  title: string;
  attachLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  errorMessage: string;
  retryLabel: string;
  hiddenFilesLabel: string;
  showHiddenFilesLabel: string;
  hideHiddenFilesLabel: string;
  getSelectionLabel: (count: number) => string;
  uploadFilesLabel: string;
  newFolderLabel: string;
  downloadLabel: string;
  downloadingLabel: string;
  deleteLabel: string;
  deletingLabel: string;
  deleteConfirmTitle: (names: string[]) => ReactNode;
  deleteConfirmBody: (names: string[]) => ReactNode;
  deleteConfirmLabel: string;
  deleteCancelLabel: string;
  uploadProgressTitle: string;
  cancelLabel: string;
  allowedTypes?: string[];
  maxSelectableFileSize?: number;
  maximumAttachmentsAmount?: number;
  canAttachFolders?: boolean;
  allowedTypesLabel?: string;
  autoSelectUploadedItems?: boolean;
}

const DialFileManagerModal: FC<Props> = ({
  isOpen,
  onClose,
  onAttach,
  bucket,
  title,
  attachLabel,
  emptyTitle,
  emptyDescription,
  errorMessage,
  retryLabel,
  hiddenFilesLabel,
  showHiddenFilesLabel,
  hideHiddenFilesLabel,
  getSelectionLabel,
  uploadFilesLabel,
  newFolderLabel,
  downloadLabel,
  downloadingLabel,
  deleteLabel,
  deletingLabel,
  deleteConfirmTitle,
  deleteConfirmBody,
  deleteConfirmLabel,
  deleteCancelLabel,
  uploadProgressTitle,
  cancelLabel,
  allowedTypes,
  maxSelectableFileSize,
  maximumAttachmentsAmount,
  canAttachFolders = false,
  allowedTypesLabel,
  autoSelectUploadedItems = true,
}) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();

  const tabLabels = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: t(DialFileManagerI18nKeys.TabMyFiles),
      [DialFileManagerTabs.Shared]: t(DialFileManagerI18nKeys.TabShared),
      [DialFileManagerTabs.Organization]: t(
        DialFileManagerI18nKeys.TabOrganization,
      ),
      [DialFileManagerTabs.Review]: '',
    }),
    [t],
  );

  const {
    activeTab,
    handleTabChange,
    tabs: allTabs,
  } = useDialFileManagerTabs(tabLabels, DialFileManagerTabs.MyFiles);

  const rootLabel =
    tabLabels[activeTab] || tabLabels[DialFileManagerTabs.MyFiles];

  const tabs = useMemo(
    () => allTabs?.filter((tab) => tab.id !== DialFileManagerTabs.Review),
    [allTabs],
  );

  const {
    items,
    isLoading,
    error,
    path,
    onPathChange,
    retry,
    onSearchFiles,
    isSearching,
    searchResults,
    clearSearchResults,
    expandedPaths,
    loadedPaths,
    onExpandedPathsChange,
    onUploadFiles,
    onValidateUpload,
    uploadBatchState,
    cancelUpload,
    clearUploadBatch,
    onCreateFolder,
    onCreateFolderValidate,
    isCreatingFolder,
    onDownloadFiles,
    isDownloading,
    onDeleteFiles,
    isDeleting,
    onMoveToFiles,
    onRenameValidate,
    isRenaming,
    uploadEnabled,
    isNewButtonDisabled,
    disabledNewButtonTooltip,
    visibleColumns,
    dateLocale,
    dateOptions,
    actionLabels: tabActionLabels,
    sharedWithMeIds,
  } = useDialFileManager({
    bucket,
    activeTab,
    rootLabel,
    onNotification: showNotification,
  });

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
  );

  const handleTabChangeWithReset = useCallback(
    (tab: DialFileManagerTabs) => {
      setSelectedPaths(new Set());
      handleTabChange(tab);
    },
    [handleTabChange],
  );

  const filesByPath = useMemo(() => {
    const result = new Map<string, DialFile>();
    const collect = (nodes: DialFile[]) => {
      nodes.forEach((item) => {
        if (
          item.nodeType === DialFileNodeType.ITEM ||
          item.nodeType === DialFileNodeType.FOLDER
        ) {
          result.set(item.path, item);
          if (item.id) result.set(item.id, item);
        }
        if (item.items) collect(item.items);
      });
    };
    collect(items);
    searchResults?.forEach((file) => {
      result.set(file.path, file);
      if (file.id) result.set(file.id, file);
    });
    return result;
  }, [items, searchResults]);

  const selectedFiles = useMemo(
    () =>
      Array.from(selectedPaths)
        .map((selectedPath) => filesByPath.get(selectedPath))
        .filter((file): file is DialFile => file != null),
    [filesByPath, selectedPaths],
  );

  const handleAttach = useCallback(() => {
    const selectedFolderPaths: string[] = [];
    const selectedFileNodes: DialFile[] = [];

    for (const file of selectedFiles) {
      if (file.nodeType === DialFileNodeType.FOLDER) {
        selectedFolderPaths.push(file.path);
      } else {
        selectedFileNodes.push(file);
      }
    }

    const dedupedFolderPaths = selectedFolderPaths.filter(
      (fp) =>
        !selectedFolderPaths.some(
          (other) => other !== fp && fp.startsWith(`${other}/`),
        ),
    );

    const validFiles = selectedFileNodes.filter((file) => {
      if (isHiddenPath(file.path)) return false;
      if (
        allowedTypes != null &&
        allowedTypes.length > 0 &&
        file.contentType != null &&
        !isMimeTypeAllowed(file.contentType, allowedTypes)
      ) {
        return false;
      }
      return true;
    });

    const dedupedFiles = validFiles.filter(
      (file) =>
        !dedupedFolderPaths.some((fp) => file.path.startsWith(`${fp}/`)),
    );

    const skippedCount = selectedFileNodes.length - validFiles.length;
    if (skippedCount > 0) {
      showNotification({
        variant: NotificationVariant.Info,
        message: t(DialFileManagerI18nKeys.UnsupportedFilesDescription),
        title: t(DialFileManagerI18nKeys.UnsupportedFilesSkipped),
      });
    }

    const totalCount = dedupedFiles.length + dedupedFolderPaths.length;
    if (
      maximumAttachmentsAmount != null &&
      maximumAttachmentsAmount > 0 &&
      totalCount > maximumAttachmentsAmount
    ) {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(DialFileManagerI18nKeys.TooManyFilesDescription, {
          count: totalCount,
          limit: maximumAttachmentsAmount,
        }),
        title: t(DialFileManagerI18nKeys.TooManyFilesSelected),
      });
      return;
    }

    const dialCoreFolderPaths = dedupedFolderPaths.flatMap((virtualPath) => {
      const file = filesByPath.get(virtualPath);
      if (file == null) return [];
      const source = file.url ?? file.id ?? '';
      const dialPath = source.startsWith('files/')
        ? source
        : `files/${file.bucket ?? bucket}/${source.replace(/^\/+/, '')}`;
      return [dialPath.endsWith('/') ? dialPath : `${dialPath}/`];
    });

    onAttach({ files: dedupedFiles, folderPaths: dialCoreFolderPaths });
  }, [
    onAttach,
    selectedFiles,
    allowedTypes,
    maximumAttachmentsAmount,
    showNotification,
    t,
    filesByPath,
    bucket,
  ]);

  const headerDescription = useMemo(() => {
    const hasTypeConstraint = allowedTypes != null && allowedTypes.length > 0;
    const hasSizeConstraint =
      maxSelectableFileSize != null && maxSelectableFileSize > 0;
    const hasCountConstraint =
      maximumAttachmentsAmount != null &&
      maximumAttachmentsAmount > 0 &&
      isFinite(maximumAttachmentsAmount);

    if (!hasTypeConstraint && !hasSizeConstraint && !hasCountConstraint) {
      return null;
    }

    const parts: string[] = [];

    if (hasTypeConstraint || hasSizeConstraint) {
      const isAllTypesAllowed =
        hasTypeConstraint &&
        (allowedTypes ?? []).some((type) => type === '*' || type === '*/*');

      const typeLabel =
        allowedTypesLabel ??
        (isAllTypesAllowed
          ? t(DialFileManagerI18nKeys.AllTypes)
          : hasTypeConstraint
            ? mimeTypesToExtensionLabels(allowedTypes ?? [])
            : undefined);

      const maxSize =
        hasSizeConstraint && maxSelectableFileSize != null
          ? formatFileSize(maxSelectableFileSize)
          : undefined;

      if (typeLabel != null && maxSize != null) {
        parts.push(
          t(DialFileManagerI18nKeys.MaxSizeSupportedTypes, {
            maxSize,
            allowedExtensions: typeLabel,
          }),
        );
      } else if (maxSize != null) {
        parts.push(t(DialFileManagerI18nKeys.MaxSizeOnly, { maxSize }));
      } else if (typeLabel != null) {
        parts.push(typeLabel);
      }
    }

    if (hasCountConstraint) {
      parts.push(
        t(DialFileManagerI18nKeys.UpToFiles, {
          count: maximumAttachmentsAmount,
        }),
      );
    }

    return `${parts.join('. ')}.`;
  }, [
    allowedTypes,
    maxSelectableFileSize,
    maximumAttachmentsAmount,
    allowedTypesLabel,
    t,
  ]);

  const unsupportedFileTypeTooltip = useMemo(() => {
    if (allowedTypes == null || allowedTypes.length === 0) {
      return undefined;
    }

    const areAllTypesAllowed = allowedTypes.some(
      (type) => type === '*' || type === '*/*',
    );

    if (areAllTypesAllowed) {
      return undefined;
    }

    const allowedExtensions =
      allowedTypesLabel ?? mimeTypesToAttachmentExtensionLabels(allowedTypes);

    return t(DialFileManagerI18nKeys.UnsupportedFileTypeTooltip, {
      allowedExtensions,
    });
  }, [allowedTypes, allowedTypesLabel, t]);

  const allowedFileTypes = useMemo(
    () => mimeTypesToDialFileAcceptTypes(allowedTypes),
    [allowedTypes],
  );

  const uploadProgressText = useMemo(() => {
    if (uploadBatchState == null) {
      return '';
    }

    const done = uploadBatchState.files.filter(
      (file) => file.status !== FileUploadStatus.Uploading,
    ).length;

    return t(DialFileManagerI18nKeys.UploadProgressSummary, {
      done,
      total: uploadBatchState.files.length,
    });
  }, [uploadBatchState, t]);

  const handleUploadCancel = useCallback(() => {
    cancelUpload();
    clearUploadBatch();
  }, [cancelUpload, clearUploadBatch]);

  const getDisabledTooltip = useCallback(
    (row: FileManagerGridRow) => {
      if (isHiddenPath(row.path)) {
        return t(DialFileManagerI18nKeys.AttachingHiddenFilesNotAllowed);
      }
      return undefined;
    },
    [t],
  );

  const isOperationInProgress =
    isDownloading ||
    isDeleting ||
    isRenaming ||
    isCreatingFolder ||
    uploadBatchState != null;

  const renameValidationMessages = useMemo(
    () => ({
      emptyName: t(DialFileManagerI18nKeys.RenameNameEmpty),
      duplicateName: t(DialFileManagerI18nKeys.RenameDuplicateName),
    }),
    [t],
  );

  const conflictResolutionPopupOptions = useMemo(
    () => ({
      singleFileTitle: t(DialFileManagerI18nKeys.ConflictSingleTitle),
      multipleFilesTitle: t(DialFileManagerI18nKeys.ConflictMultipleTitle),
      actionLabels: {
        replace: t(DialFileManagerI18nKeys.ConflictReplace),
        duplicate: t(DialFileManagerI18nKeys.ConflictDuplicate),
        cancel: t(ButtonsI18nKeys.Cancel),
      },
      strategyLabels: {
        replaceAll: t(DialFileManagerI18nKeys.ConflictReplaceAll),
        duplicateAll: t(DialFileManagerI18nKeys.ConflictDuplicateAll),
        decideForEach: t(DialFileManagerI18nKeys.ConflictDecideForEach),
      },
      confirmLabel: t(ButtonsI18nKeys.Confirm),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
    }),
    [t],
  );

  const deleteConfirmationOptions = useMemo(
    () => ({
      cancelLabel: deleteCancelLabel,
      confirmLabel: deleteConfirmLabel,
      titleRenderer: deleteConfirmTitle,
      contentRenderer: deleteConfirmBody,
    }),
    [
      deleteCancelLabel,
      deleteConfirmLabel,
      deleteConfirmTitle,
      deleteConfirmBody,
    ],
  );

  const actionLabels = useMemo(() => {
    const labels: Partial<Record<DialFileManagerActions, string>> = {};
    if (DialFileManagerActions.Download in tabActionLabels) {
      labels[DialFileManagerActions.Download] = downloadLabel;
    }
    if (DialFileManagerActions.Delete in tabActionLabels) {
      labels[DialFileManagerActions.Delete] = deleteLabel;
    }
    if (DialFileManagerActions.Rename in tabActionLabels) {
      labels[DialFileManagerActions.Rename] = t(
        DialFileManagerI18nKeys.RenameAction,
      );
    }
    return labels;
  }, [tabActionLabels, downloadLabel, deleteLabel, t]);

  const gridOptions = useMemo(
    () => ({
      selectionMode: GridSelectionMode.MULTIPLE,
      visibleColumns,
      dateLocale,
      dateOptions,
      additionalGridOptions: {
        domLayout: 'normal' as const,
        rowSelection: {
          mode: 'multiRow' as const,
          isRowSelectable: (node: { data?: FileManagerGridRow | null }) => {
            const row = node.data;
            if (row == null) return false;

            if (isHiddenPath(row.path)) return false;

            if (row.nodeType === DialFileNodeType.FOLDER) {
              return canAttachFolders;
            }

            if (row.nodeType === DialFileNodeType.ITEM) {
              if (
                allowedTypes != null &&
                allowedTypes.length > 0 &&
                row.contentType != null &&
                !isMimeTypeAllowed(row.contentType, allowedTypes)
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

              return true;
            }

            return false;
          },
        },
      },
      actionLabels,
    }),
    [
      visibleColumns,
      dateLocale,
      dateOptions,
      actionLabels,
      allowedTypes,
      maxSelectableFileSize,
      canAttachFolders,
    ],
  );

  const treeHeaderByTab: Record<DialFileManagerTabs, string> = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: t(
        DialFileManagerI18nKeys.MyFilesTreeHeader,
      ),
      [DialFileManagerTabs.Shared]: t(DialFileManagerI18nKeys.SharedTreeHeader),
      [DialFileManagerTabs.Organization]: t(
        DialFileManagerI18nKeys.OrganizationTreeHeader,
      ),
      [DialFileManagerTabs.Review]: '',
    }),
    [t],
  );

  const treeOptions = useMemo(
    () => ({
      header: treeHeaderByTab[activeTab],
      expandedPaths,
      loadedPaths,
      onExpandedPathsChange,
      actionLabels,
    }),
    [
      treeHeaderByTab,
      activeTab,
      expandedPaths,
      loadedPaths,
      onExpandedPathsChange,
      actionLabels,
    ],
  );

  const emptyStateByTab = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: {
        title: t(DialFileManagerI18nKeys.MyFilesEmptyStateTitle),
        description: t(DialFileManagerI18nKeys.MyFilesEmptyStateDescription),
      },
      [DialFileManagerTabs.Shared]: {
        title: t(DialFileManagerI18nKeys.SharedEmptyStateTitle),
        description: t(DialFileManagerI18nKeys.SharedEmptyStateDescription),
      },
      [DialFileManagerTabs.Organization]: {
        title: t(DialFileManagerI18nKeys.OrganizationEmptyStateTitle),
        description: t(
          DialFileManagerI18nKeys.OrganizationEmptyStateDescription,
        ),
      },
      [DialFileManagerTabs.Review]: {
        title: emptyTitle,
        description: emptyDescription,
      },
    }),
    [t, emptyTitle, emptyDescription],
  );

  const toolbarOptions = useMemo(
    () => ({
      tabs,
      activeTab,
      onTabChange: handleTabChangeWithReset,
      showHiddenFilesToggle: true,
      hiddenFilesSwitcherLabel: hiddenFilesLabel,
      showHiddenFilesLabel,
      hideHiddenFilesLabel,
      isNewButtonDisabled,
      disabledNewButtonTooltip,
      newActions: {
        uploadFiles: { label: uploadFilesLabel },
        newFolder: { label: newFolderLabel },
      },
    }),
    [
      tabs,
      activeTab,
      handleTabChangeWithReset,
      hiddenFilesLabel,
      showHiddenFilesLabel,
      hideHiddenFilesLabel,
      isNewButtonDisabled,
      disabledNewButtonTooltip,
      uploadFilesLabel,
      newFolderLabel,
    ],
  );

  const bulkActionsToolbarOptions = useMemo(
    () => ({
      getSelectionLabel,
      actionLabels,
    }),
    [getSelectionLabel, actionLabels],
  );

  return (
    <>
      <DialPopup
        open={isOpen}
        header={
          <div className="flex flex-col gap-1">
            <span>{title}</span>
            {headerDescription != null && (
              <p className="text-start text-sm font-normal">
                {headerDescription}
              </p>
            )}
          </div>
        }
        size={PopupSize.Lg}
        className="flex !h-[min(800px,100dvh)] w-full flex-col !bg-layer-2 [&>[aria-label='popup-description']]:flex [&>[aria-label='popup-description']]:min-h-0 [&>[aria-label='popup-description']]:flex-col"
        onClose={onClose}
        hideClose={true}
        footer={
          <div className="flex justify-end px-6 py-4">
            <DialPrimaryButton
              label={attachLabel}
              disabled={
                selectedFiles.length === 0 || isLoading || isOperationInProgress
              }
              onClick={handleAttach}
            />
          </div>
        }
      >
        {error != null ? (
          <div role="alert" className="flex flex-col items-center gap-4 p-6">
            <p>{errorMessage}</p>
            <DialPrimaryButton label={retryLabel} onClick={retry} />
          </div>
        ) : (
          <div className="relative flex min-h-0 w-full grow overflow-auto bg-layer-2">
            <DialFileManager
              className="min-h-0 w-full grow bg-layer-2"
              gridClassName="size-full"
              items={items}
              path={path}
              onPathChange={onPathChange}
              filesLoading={isLoading}
              allowedFileTypes={allowedFileTypes}
              maxSelectableFileSize={maxSelectableFileSize}
              selectedPaths={selectedPaths}
              onSelectedPathsChange={setSelectedPaths}
              navigationPanelOptions={{
                searchable: true,
              }}
              hideSearchPathItemName={true}
              onSearchFiles={onSearchFiles}
              searchInProgress={isSearching}
              searchResults={searchResults ?? []}
              clearSearchResults={clearSearchResults}
              gridOptions={gridOptions}
              treeOptions={treeOptions}
              toolbarOptions={toolbarOptions}
              bulkActionsToolbarOptions={bulkActionsToolbarOptions}
              autoSelectUploadedItems={autoSelectUploadedItems}
              emptyStateTitle={
                searchResults != null && !isSearching
                  ? t(DialFileManagerI18nKeys.SearchEmptyStateTitle)
                  : emptyStateByTab[activeTab].title
              }
              emptyStateDescription={
                searchResults != null && !isSearching
                  ? ''
                  : emptyStateByTab[activeTab].description
              }
              uploadEnabled={uploadEnabled}
              sharedWithMeIds={sharedWithMeIds}
              onUploadFiles={onUploadFiles}
              onValidateUpload={onValidateUpload}
              onCreateFolder={onCreateFolder}
              onCreateFolderValidate={onCreateFolderValidate}
              onDownloadFiles={onDownloadFiles}
              onDeleteFiles={onDeleteFiles}
              onMoveToFiles={onMoveToFiles}
              onRenameValidate={onRenameValidate}
              renameValidationMessages={renameValidationMessages}
              isRenameFileAvailable={uploadEnabled}
              deleteConfirmationOptions={deleteConfirmationOptions}
              conflictResolutionPopupOptions={conflictResolutionPopupOptions}
              forbiddenSymbolsRegExp={NOT_ALLOWED_SYMBOLS_REGEXP}
              forbiddenSymbolsTooltip={t(
                DialFileManagerI18nKeys.ForbiddenSymbolsTooltip,
              )}
              getDisabledTooltip={getDisabledTooltip}
              unsupportedFileTypeTooltip={unsupportedFileTypeTooltip}
            />
            {isDownloading && (
              <div
                aria-live="polite"
                className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout md:p-4"
              >
                <DialLoader
                  size={32}
                  fullWidth={false}
                  ariaLabel={downloadingLabel}
                />
              </div>
            )}
            {isDeleting && (
              <div
                aria-live="polite"
                className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout md:p-4"
              >
                <DialLoader
                  size={32}
                  fullWidth={false}
                  ariaLabel={deletingLabel}
                />
              </div>
            )}
            {isRenaming && (
              <div
                aria-live="polite"
                className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout md:p-4"
              >
                <DialLoader
                  size={32}
                  fullWidth={false}
                  ariaLabel={t(DialFileManagerI18nKeys.RenamingLabel)}
                />
              </div>
            )}
          </div>
        )}
      </DialPopup>

      {uploadBatchState != null && (
        <UploadProgressModal
          batchState={uploadBatchState}
          uploadProgressTitle={uploadProgressTitle}
          uploadProgressText={uploadProgressText}
          cancelLabel={cancelLabel}
          onCancel={handleUploadCancel}
        />
      )}
    </>
  );
};

export default memo(DialFileManagerModal);
