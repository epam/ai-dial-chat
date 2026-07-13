import { PrimaryButton } from '@epam/ai-dial-kit';
import {
  DialFileManager,
  DialFileManagerActions,
  DialFileManagerTabs,
  DialSpinner,
  GridSelectionMode,
  NOT_ALLOWED_SYMBOLS_REGEXP,
  type DialFileAcceptType,
  type FileManagerGridRow,
  type ToolbarOptions,
} from '@epam/ai-dial-ui-kit';
import { memo, useMemo, type FC } from 'react';
import OperationLoaderModal from '../../components/DialFileManagerModal/OperationLoaderModal';
import { FileUploadStatus } from '../../components/DialFileManagerModal/types/upload';
import UploadProgressModal from '../../components/DialFileManagerModal/UploadProgressModal';
import type { UseDialFileManagerResult } from '../../hooks/files/useDialFileManager';
import { getParentFolderPath } from '../../utils/resolve-dial-file-api-path';
import type {
  DialFileManagerDestinationFolderPopupOptions,
  DialFileManagerShellLabels,
} from './types/labels';

interface Props {
  hookResult: UseDialFileManagerResult;
  labels: DialFileManagerShellLabels;
  activeTab: DialFileManagerTabs;
  tabs: ToolbarOptions['tabs'];
  onTabChange: (tab: DialFileManagerTabs) => void;
  selectedPaths: Set<string>;
  onSelectedPathsChange: (paths: Set<string>) => void;
  autoSelectUploadedItems?: boolean;
  allowedFileTypes?: DialFileAcceptType[];
  maxSelectableFileSize?: number;
  isRowSelectable?: (node: { data?: FileManagerGridRow | null }) => boolean;
  getDisabledTooltip?: (row: FileManagerGridRow) => string | undefined;
  unsupportedFileTypeTooltip?: string;
}

/**
 * Renders the DialFileManager (ui-kit) grid/tree/toolbar and its operation
 * overlays (upload progress, download/delete/rename spinners, error/retry
 * panel) from a `useDialFileManager` result. Does not own popup chrome, an
 * attach footer, or any attach-only selection constraints — those are
 * host-owned (see DialFileManagerModal and DialFileManagerPage).
 */
const DialFileManagerShell: FC<Props> = ({
  hookResult,
  labels,
  activeTab,
  tabs,
  onTabChange,
  selectedPaths,
  onSelectedPathsChange,
  autoSelectUploadedItems = false,
  allowedFileTypes,
  maxSelectableFileSize,
  isRowSelectable,
  getDisabledTooltip,
  unsupportedFileTypeTooltip,
}) => {
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
    onDownloadFiles,
    isDownloading,
    onDeleteFiles,
    isDeleting,
    onMoveToFiles,
    onRenameValidate,
    isRenaming,
    onCopyFiles,
    isCopying,
    isMoving,
    cancelCopyMove,
    uploadEnabled,
    isNewButtonDisabled,
    disabledNewButtonTooltip,
    visibleColumns,
    dateLocale,
    dateOptions,
    actionLabels: tabActionLabels,
    sharedWithMeIds,
  } = hookResult;

  const actionLabels = useMemo(() => {
    const result: Partial<Record<DialFileManagerActions, string>> = {};
    if (DialFileManagerActions.Download in tabActionLabels) {
      result[DialFileManagerActions.Download] = labels.downloadLabel;
    }
    if (DialFileManagerActions.Delete in tabActionLabels) {
      result[DialFileManagerActions.Delete] = labels.deleteLabel;
    }
    if (DialFileManagerActions.Rename in tabActionLabels) {
      result[DialFileManagerActions.Rename] = labels.renameLabel;
    }
    if (DialFileManagerActions.Copy in tabActionLabels) {
      result[DialFileManagerActions.Copy] = labels.copyLabel;
    }
    if (DialFileManagerActions.Move in tabActionLabels) {
      result[DialFileManagerActions.Move] = labels.moveLabel;
    }
    if (DialFileManagerActions.Duplicate in tabActionLabels) {
      result[DialFileManagerActions.Duplicate] = labels.duplicateLabel;
    }
    return result;
  }, [
    tabActionLabels,
    labels.downloadLabel,
    labels.deleteLabel,
    labels.renameLabel,
    labels.copyLabel,
    labels.moveLabel,
    labels.duplicateLabel,
  ]);

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
          isRowSelectable: isRowSelectable ?? ((): boolean => true),
        },
      },
      actionLabels,
    }),
    [visibleColumns, dateLocale, dateOptions, actionLabels, isRowSelectable],
  );

  const treeOptions = useMemo(
    () => ({
      header: labels.treeHeaderByTab[activeTab],
      expandedPaths,
      loadedPaths,
      onExpandedPathsChange,
      actionLabels,
    }),
    [
      labels.treeHeaderByTab,
      activeTab,
      expandedPaths,
      loadedPaths,
      onExpandedPathsChange,
      actionLabels,
    ],
  );

  const toolbarOptions = useMemo(
    () => ({
      tabs,
      activeTab,
      onTabChange,
      showHiddenFilesToggle: true,
      hiddenFilesSwitcherLabel: labels.hiddenFilesLabel,
      showHiddenFilesLabel: labels.showHiddenFilesLabel,
      hideHiddenFilesLabel: labels.hideHiddenFilesLabel,
      isNewButtonDisabled,
      disabledNewButtonTooltip,
      newActions: {
        uploadFiles: { label: labels.uploadFilesLabel },
        newFolder: { label: labels.newFolderLabel },
      },
    }),
    [
      tabs,
      activeTab,
      onTabChange,
      labels.hiddenFilesLabel,
      labels.showHiddenFilesLabel,
      labels.hideHiddenFilesLabel,
      isNewButtonDisabled,
      disabledNewButtonTooltip,
      labels.uploadFilesLabel,
      labels.newFolderLabel,
    ],
  );

  const bulkActionsToolbarOptions = useMemo(
    () => ({
      getSelectionLabel: labels.getSelectionLabel,
      actionLabels,
    }),
    [labels.getSelectionLabel, actionLabels],
  );

  const deleteConfirmationOptions = useMemo(
    () => ({
      cancelLabel: labels.deleteCancelLabel,
      confirmLabel: labels.deleteConfirmLabel,
      titleRenderer: labels.deleteConfirmTitle,
      contentRenderer: labels.deleteConfirmBody,
    }),
    [
      labels.deleteCancelLabel,
      labels.deleteConfirmLabel,
      labels.deleteConfirmTitle,
      labels.deleteConfirmBody,
    ],
  );

  const commonSelectedParentFolder = useMemo(() => {
    let commonParent: string | undefined;
    for (const selectedPath of selectedPaths) {
      const parent = getParentFolderPath(selectedPath);
      if (commonParent === undefined) {
        commonParent = parent;
      } else if (commonParent !== parent) {
        return undefined;
      }
    }
    return commonParent;
  }, [selectedPaths]);

  const destinationFolderPopupOptions = useMemo(
    (): DialFileManagerDestinationFolderPopupOptions & {
      sourceFolder?: string;
    } => ({
      copyLabel: labels.copyLabel,
      moveLabel: labels.moveLabel,
      addFolderLabel: labels.addFolderLabel,
      hiddenFilesSwitcherLabel: labels.hiddenFilesSwitcherLabel,
      getCopyHeader: labels.getCopyHeader,
      getMoveHeader: labels.getMoveHeader,
      disabledPathTooltip: labels.moveSourceDisabledTooltip,
      emptyStateTitle: labels.folderPickerEmptyStateTitle,
      emptyStateDescription: labels.folderPickerEmptyStateDescription,
      sourceFolder: commonSelectedParentFolder,
    }),
    [
      labels.copyLabel,
      labels.moveLabel,
      labels.addFolderLabel,
      labels.hiddenFilesSwitcherLabel,
      labels.getCopyHeader,
      labels.getMoveHeader,
      labels.moveSourceDisabledTooltip,
      labels.folderPickerEmptyStateTitle,
      labels.folderPickerEmptyStateDescription,
      commonSelectedParentFolder,
    ],
  );

  const handleUploadCancel = (): void => {
    cancelUpload();
    clearUploadBatch();
  };

  const uploadProgressText = useMemo(() => {
    if (uploadBatchState == null) {
      return '';
    }
    const done = uploadBatchState.files.filter(
      (file) => file.status !== FileUploadStatus.Uploading,
    ).length;
    return labels.getUploadProgressText(done, uploadBatchState.files.length);
  }, [uploadBatchState, labels]);

  return (
    <>
      {error != null ? (
        <div role="alert" className="flex flex-col items-center gap-4 p-6">
          <p>{labels.errorMessage}</p>
          <PrimaryButton label={labels.retryLabel} onClick={retry} />
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
            onSelectedPathsChange={onSelectedPathsChange}
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
                ? labels.searchEmptyStateTitle
                : labels.emptyStateByTab[activeTab].title
            }
            emptyStateDescription={
              searchResults != null && !isSearching
                ? ''
                : labels.emptyStateByTab[activeTab].description
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
            onCopyFiles={onCopyFiles}
            onRenameValidate={onRenameValidate}
            renameValidationMessages={labels.renameValidationMessages}
            isRenameFileAvailable={uploadEnabled}
            deleteConfirmationOptions={deleteConfirmationOptions}
            conflictResolutionPopupOptions={
              labels.conflictResolutionPopupOptions
            }
            destinationFolderPopupOptions={destinationFolderPopupOptions}
            forbiddenSymbolsRegExp={NOT_ALLOWED_SYMBOLS_REGEXP}
            forbiddenSymbolsTooltip={labels.forbiddenSymbolsTooltip}
            getDisabledTooltip={getDisabledTooltip}
            unsupportedFileTypeTooltip={unsupportedFileTypeTooltip}
          />
          {isDownloading && (
            <div
              aria-live="polite"
              className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout desktop:p-4"
            >
              <DialSpinner
                size={32}
                fullWidth={false}
                ariaLabel={labels.downloadingLabel}
              />
            </div>
          )}
          {isDeleting && (
            <div
              aria-live="polite"
              className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout desktop:p-4"
            >
              <DialSpinner
                size={32}
                fullWidth={false}
                ariaLabel={labels.deletingLabel}
              />
            </div>
          )}
          {isRenaming && !isMoving && (
            <div
              aria-live="polite"
              className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout desktop:p-4"
            >
              <DialSpinner
                size={32}
                fullWidth={false}
                ariaLabel={labels.renamingLabel}
              />
            </div>
          )}
        </div>
      )}

      {uploadBatchState != null && (
        <UploadProgressModal
          batchState={uploadBatchState}
          uploadProgressTitle={labels.uploadProgressTitle}
          uploadProgressText={uploadProgressText}
          cancelLabel={labels.cancelLabel}
          onCancel={handleUploadCancel}
        />
      )}

      {(isCopying || isMoving) && (
        <OperationLoaderModal
          title={
            isMoving
              ? labels.operationLoaderMoveTitle
              : labels.operationLoaderCopyTitle
          }
          text={isMoving ? labels.movingLabel : labels.copyingLabel}
          cancelLabel={labels.operationLoaderCancelLabel}
          onCancel={cancelCopyMove}
        />
      )}
    </>
  );
};

export default memo(DialFileManagerShell);
