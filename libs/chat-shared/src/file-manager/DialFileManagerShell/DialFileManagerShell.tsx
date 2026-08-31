import {
  DialFileManager,
  DialFileManagerActions,
  DialFileManagerTabs,
  GridSelectionMode,
  type DialFileAcceptType,
  type FileManagerGridRow,
  type ToolbarOptions,
} from '@epam/ai-dial-react-file-manager';
import {
  NOT_ALLOWED_SYMBOLS_REGEXP,
  PrimaryButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { memo, useEffect, useMemo, useState, type FC } from 'react';
import type { FileManagerController } from '../file-manager-controller';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../file-manager-variant';
import type {
  DialFileManagerDestinationFolderPopupOptions,
  DialFileManagerShellLabels,
  EmptyStateCopy,
} from '../labels';
import { OperationLoaderModal } from '../OperationLoaderModal/OperationLoaderModal';
import { getParentFolderPath } from '../path';
import { FileUploadStatus } from '../upload-batch';
import { UploadProgressModal } from '../UploadProgressModal/UploadProgressModal';
import { useGridEditingScroll } from '../useGridEditingScroll/useGridEditingScroll';

type DestinationFolderPopupOptions =
  DialFileManagerDestinationFolderPopupOptions & {
    sourceFolder?: string;
    destinationFolderPath?: string;
    setDestinationFolderPath?: (path?: string) => void;
    filesLoading?: boolean;
  };

const normalizeVirtualFolderPath = (value: string): string => {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed || '/';
};

interface OverlayFlags {
  isDownloading: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  isMoving: boolean;
  isUnsharing: boolean;
  isRemovingAccess: boolean;
}

type OverlayLabels = Pick<
  DialFileManagerShellLabels,
  | 'downloadingLabel'
  | 'deletingLabel'
  | 'renamingLabel'
  | 'unsharingLabel'
  | 'removingAccessLabel'
>;

const resolveOverlayAriaLabel = (
  flags: OverlayFlags,
  labels: OverlayLabels,
): string | undefined => {
  if (flags.isDownloading) {
    return labels.downloadingLabel;
  } else if (flags.isDeleting) {
    return labels.deletingLabel;
  } else if (flags.isRenaming && !flags.isMoving) {
    return labels.renamingLabel;
  } else if (flags.isUnsharing) {
    return labels.unsharingLabel;
  } else if (flags.isRemovingAccess) {
    return labels.removingAccessLabel;
  }
  return undefined;
};

/** Props for the shared file-manager shell component. */
export interface DialFileManagerShellProps {
  /** Structural view contract containing all controller state and callbacks. */
  controller: FileManagerController;
  /** Pre-translated labels the shell renders as-is. */
  labels: DialFileManagerShellLabels;
  /** Currently active tab. */
  activeTab: DialFileManagerTabs;
  /** Tab configuration for the toolbar. */
  tabs: ToolbarOptions['tabs'];
  /** Called when the user switches tabs. */
  onTabChange: (tab: DialFileManagerTabs) => void;
  /** Set of currently selected file/folder virtual paths. */
  selectedPaths: Set<string>;
  /** Called when the selection changes. */
  onSelectedPathsChange: (paths: Set<string>) => void;
  /** Host driving this shell instance — gates the upload-archive toolbar entry (standalone-only). */
  variant: DialFileManagerVariant;
  /** Action-set gate for the upload-archive toolbar entry (Full-only). */
  actionProfile: DialFileManagerActionProfile;
  /** Whether to auto-select items after upload completes. Defaults to `false`. */
  autoSelectUploadedItems?: boolean;
  /** MIME type filters for selectable files. */
  allowedFileTypes?: DialFileAcceptType[];
  /** Maximum file size in bytes for selectable files. */
  maxSelectableFileSize?: number;
  /** Custom row-selectability predicate. */
  isRowSelectable?: (node: { data?: FileManagerGridRow | null }) => boolean;
  /** Returns a tooltip for disabled rows, or undefined for enabled rows. */
  getDisabledTooltip?: (row: FileManagerGridRow) => string | undefined;
  /** Tooltip shown on files with an unsupported type. */
  unsupportedFileTypeTooltip?: string;
}

/**
 * Renders the DialFileManager grid/tree/toolbar and its operation overlays
 * from a `FileManagerController`. Does not own popup chrome, an attach footer,
 * or any attach-only selection constraints — those are host-owned.
 */
export const DialFileManagerShell: FC<DialFileManagerShellProps> = ({
  controller,
  labels,
  activeTab,
  tabs,
  onTabChange,
  selectedPaths,
  onSelectedPathsChange,
  variant,
  actionProfile,
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
    onFolderPopupPathChange,
    folderPopupLoadingPaths,
    onUploadFiles,
    onUploadArchive,
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
    sharedByMePaths,
    onUnshareFiles,
    isUnsharing,
    onRemoveFilesAccess,
    isRemovingAccess,
    fileMetadata,
    isFileMetadataLoading,
    onGetInfo,
    clearMetadata,
  } = controller;

  const [destinationFolderPath, setDestinationFolderPath] = useState<
    string | undefined
  >(undefined);

  const { handleGridApiChange, reset: resetGridEditingScroll } =
    useGridEditingScroll();

  useEffect(() => {
    resetGridEditingScroll();
  }, [activeTab, resetGridEditingScroll]);

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
    if (DialFileManagerActions.Unshare in tabActionLabels) {
      result[DialFileManagerActions.Unshare] = labels.unshareLabel;
    }
    if (DialFileManagerActions.RemoveAccess in tabActionLabels) {
      result[DialFileManagerActions.RemoveAccess] = labels.removeAccessLabel;
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
    labels.unshareLabel,
    labels.removeAccessLabel,
  ]);

  const gridActionLabels = useMemo(() => {
    if (!(DialFileManagerActions.Info in tabActionLabels)) return actionLabels;
    return { ...actionLabels, [DialFileManagerActions.Info]: labels.infoLabel };
  }, [actionLabels, tabActionLabels, labels.infoLabel]);

  const allSelectedItemsSharedByMe = useMemo(() => {
    if (selectedPaths.size === 0) return false;
    for (const selectedPath of selectedPaths) {
      if (!sharedByMePaths.has(selectedPath)) return false;
    }
    return true;
  }, [selectedPaths, sharedByMePaths]);

  const bulkActionLabels = useMemo(() => {
    if (allSelectedItemsSharedByMe) {
      return actionLabels;
    }
    const {
      [DialFileManagerActions.RemoveAccess]: _removeAccess,
      ...withoutRemoveAccess
    } = actionLabels;
    return withoutRemoveAccess;
  }, [actionLabels, allSelectedItemsSharedByMe]);

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
      actionLabels: gridActionLabels,
    }),
    [
      visibleColumns,
      dateLocale,
      dateOptions,
      gridActionLabels,
      isRowSelectable,
    ],
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

  const showUploadArchiveAction =
    variant === DialFileManagerVariant.Standalone &&
    actionProfile === DialFileManagerActionProfile.Full &&
    activeTab === DialFileManagerTabs.MyFiles &&
    uploadEnabled;

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
        ...(showUploadArchiveAction
          ? { uploadArchive: { label: labels.uploadArchiveAction } }
          : {}),
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
      showUploadArchiveAction,
      labels.uploadArchiveAction,
    ],
  );

  const bulkActionsToolbarOptions = useMemo(
    () => ({
      getSelectionLabel: labels.getSelectionLabel,
      actionLabels: bulkActionLabels,
    }),
    [labels.getSelectionLabel, bulkActionLabels],
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

  const isDestinationFolderLoading =
    destinationFolderPath != null &&
    folderPopupLoadingPaths.has(
      normalizeVirtualFolderPath(destinationFolderPath),
    );

  const disabledDestinationPath = isDestinationFolderLoading
    ? destinationFolderPath
    : commonSelectedParentFolder;

  const destinationFolderPopupOptions = useMemo(
    (): DestinationFolderPopupOptions => ({
      copyLabel: labels.copyLabel,
      moveLabel: labels.moveLabel,
      addFolderLabel: labels.addFolderLabel,
      hiddenFilesSwitcherLabel: labels.hiddenFilesSwitcherLabel,
      getCopyHeader: labels.getCopyHeader,
      getMoveHeader: labels.getMoveHeader,
      disabledPathTooltip: isDestinationFolderLoading
        ? labels.folderPickerLoadingTooltip
        : labels.moveSourceDisabledTooltip,
      emptyStateTitle: labels.folderPickerEmptyStateTitle,
      emptyStateDescription: labels.folderPickerEmptyStateDescription,
      sourceFolder: disabledDestinationPath,
      destinationFolderPath,
      setDestinationFolderPath,
      filesLoading: isDestinationFolderLoading,
    }),
    [
      labels.copyLabel,
      labels.moveLabel,
      labels.addFolderLabel,
      labels.hiddenFilesSwitcherLabel,
      labels.getCopyHeader,
      labels.getMoveHeader,
      labels.folderPickerLoadingTooltip,
      labels.moveSourceDisabledTooltip,
      labels.folderPickerEmptyStateTitle,
      labels.folderPickerEmptyStateDescription,
      isDestinationFolderLoading,
      disabledDestinationPath,
      destinationFolderPath,
    ],
  );

  const handleUploadCancel = (): void => {
    cancelUpload();
    clearUploadBatch();
  };

  const fileMetadataPopupOptions = useMemo(
    () => ({
      fileMetadata,
      loading: isFileMetadataLoading,
      clearMetadata,
      header: labels.metadataHeader,
      nameLabel: labels.metadataNameLabel,
      pathLabel: labels.metadataPathLabel,
      modifiedDateLabel: labels.metadataModifiedDateLabel,
      sizeLabel: labels.metadataSizeLabel,
      authorLabel: labels.metadataAuthorLabel,
    }),
    [
      fileMetadata,
      isFileMetadataLoading,
      clearMetadata,
      labels.metadataHeader,
      labels.metadataNameLabel,
      labels.metadataPathLabel,
      labels.metadataModifiedDateLabel,
      labels.metadataSizeLabel,
      labels.metadataAuthorLabel,
    ],
  );

  const overlayLabel = resolveOverlayAriaLabel(
    {
      isDownloading,
      isDeleting,
      isRenaming,
      isMoving,
      isUnsharing,
      isRemovingAccess,
    },
    labels,
  );

  const uploadProgressText = useMemo(() => {
    if (uploadBatchState == null) {
      return '';
    }
    const done = uploadBatchState.files.filter(
      (file) => file.status !== FileUploadStatus.Uploading,
    ).length;
    return labels.getUploadProgressText(done, uploadBatchState.files.length);
  }, [uploadBatchState, labels]);

  const emptyStateCopy = useMemo((): EmptyStateCopy => {
    if (searchResults != null && !isSearching) {
      return { title: labels.searchEmptyStateTitle, description: '' };
    }
    const isInSubfolder = path.split('/').filter(Boolean).length > 1;
    if (isInSubfolder) {
      return { title: labels.folderEmptyStateTitle, description: '' };
    }
    return labels.emptyStateByTab[activeTab];
  }, [
    searchResults,
    isSearching,
    path,
    labels.searchEmptyStateTitle,
    labels.folderEmptyStateTitle,
    labels.emptyStateByTab,
    activeTab,
  ]);

  return (
    <>
      {error != null ? (
        <div role="alert" className="flex flex-col items-center gap-4 p-6">
          <p>{labels.errorMessage}</p>
          <PrimaryButton label={labels.retryLabel} onClick={retry} />
        </div>
      ) : (
        <div className="relative flex min-h-0 w-full grow overflow-auto bg-layer-sunken">
          <DialFileManager
            className="min-h-0 w-full grow bg-layer-sunken"
            gridClassName="size-full"
            items={items}
            path={path}
            onPathChange={onPathChange}
            onGridApiChange={handleGridApiChange}
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
            onFolderPopupPathChange={onFolderPopupPathChange}
            toolbarOptions={toolbarOptions}
            bulkActionsToolbarOptions={bulkActionsToolbarOptions}
            autoSelectUploadedItems={autoSelectUploadedItems}
            emptyStateTitle={emptyStateCopy.title}
            emptyStateDescription={emptyStateCopy.description}
            uploadEnabled={uploadEnabled}
            sharedWithMeIds={sharedWithMeIds}
            sharedByMePaths={sharedByMePaths}
            onUnshareFiles={onUnshareFiles}
            onRemoveFilesAccess={onRemoveFilesAccess}
            fileMetadataPopupOptions={fileMetadataPopupOptions}
            onGetInfo={onGetInfo}
            onUploadFiles={onUploadFiles}
            onUploadArchive={onUploadArchive}
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
          {overlayLabel != null && (
            <div
              aria-live="polite"
              className="absolute inset-0 z-[52] flex items-center justify-center bg-backdrop desktop:p-4"
            >
              <Spinner size={32} fullWidth={false} ariaLabel={overlayLabel} />
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
