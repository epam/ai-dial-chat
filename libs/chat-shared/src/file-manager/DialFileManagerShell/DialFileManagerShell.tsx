import {
  DialFileManager,
  DialFileManagerActions,
  DialFileManagerTabs,
  GridSelectionMode,
  type DialFileAcceptType,
  type FileManagerGridRow,
  type FileTreeOptions,
} from '@epam/ai-dial-react-file-manager';
import {
  ButtonVariant,
  NOT_ALLOWED_SYMBOLS_REGEXP,
  PrimaryButton,
  Spinner,
  TransferQueue,
} from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import type { FileManagerSelectableNode } from '../../types/file-manager-node';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
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
import type { DialFileManagerShellStyles } from '../shell-styles';
import {
  buildTransferQueueLabels,
  parseTransferQueueRowId,
  toTransferQueueItems,
  TransferQueueRowKind,
} from '../upload-queue';
import { useGridEditingScroll } from '../useGridEditingScroll/useGridEditingScroll';
import styles from './DialFileManagerShell.module.scss';

type DestinationFolderPopupOptions =
  DialFileManagerDestinationFolderPopupOptions & {
    sourceFolder?: string;
    destinationFolderPath?: string;
    setDestinationFolderPath?: (path?: string) => void;
    filesLoading?: boolean;
  };

interface OverlayFlags {
  isDeleting: boolean;
  isRenaming: boolean;
  isMoving: boolean;
  isUnsharing: boolean;
  isRemovingAccess: boolean;
}

type OverlayLabels = Pick<
  DialFileManagerShellLabels,
  'deletingLabel' | 'renamingLabel' | 'unsharingLabel' | 'removingAccessLabel'
>;

const resolveOverlayAriaLabel = (
  flags: OverlayFlags,
  labels: OverlayLabels,
): string | undefined => {
  /* Downloads have no overlay: they run as transfer-queue rows. */
  if (flags.isDeleting) {
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
  /** Filter chips scoping the tree and the grid, rendered above the folder tree. */
  tabs: FileTreeOptions['tabs'];
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
  /** Maximum file size in bytes for selectable files, and — reused as the ui-kit's own `maxFileSize` — the maximum size accepted for a newly-uploaded file. */
  maxSelectableFileSize?: number;
  /** Pre-translated message shown by the ui-kit when a newly-selected file exceeds `maxSelectableFileSize`. Omit to leave upload-size validation unrestricted regardless of `maxSelectableFileSize`. */
  oversizedUploadMessage?: string;
  /** Custom row-selectability predicate, forwarded to the grid's row selection. */
  isRowSelectable?: (node: {
    data?: FileManagerSelectableNode | null;
  }) => boolean;
  /** Returns a tooltip for disabled rows, or undefined for enabled rows. */
  getDisabledTooltip?: (row: FileManagerGridRow) => string | undefined;
  /** Tooltip shown on files with an unsupported type. */
  unsupportedFileTypeTooltip?: string;
  /**
   * Classes for the folders-tree panel. Replaces the panel's default classes
   * (including its width), so include `shrink-0` and an explicit width.
   * Omit to keep the variant's default.
   */
  treeContainerClassName?: string;
  /** Called with the virtual path of the file the user chose to preview. */
  onPreview?: (path?: string) => void;
  /** Dotted extensions (e.g. `.md`) the Preview row action is offered for. The file manager matches them exactly as written, so list every spelling that should qualify. */
  previewExtensions?: string[];
  /** Color overrides, e.g. a different surface background. */
  styles?: DialFileManagerShellStyles;
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
  oversizedUploadMessage,
  isRowSelectable,
  getDisabledTooltip,
  unsupportedFileTypeTooltip,
  treeContainerClassName,
  onPreview,
  previewExtensions,
  styles: shellStyles,
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
    cancelUploadFile,
    clearUploadBatch,
    downloadBatchState,
    cancelDownloadFile,
    cancelAllDownloads,
    clearDownloadBatch,
    onCreateFolder,
    onCreateFolderValidate,
    onDownloadFiles,
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
    sectionTab,
  } = controller;

  /* Per-tab rules follow the browsed folder's source tab; the strip keeps `activeTab`. */
  const gateTab = sectionTab ?? activeTab;

  const [destinationFolderPath, setDestinationFolderPath] = useState<
    string | undefined
  >(undefined);

  const { handleGridApiChange, reset: resetGridEditingScroll } =
    useGridEditingScroll();

  useEffect(() => {
    resetGridEditingScroll();
  }, [gateTab, resetGridEditingScroll]);

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
    const withPreview =
      labels.previewLabel != null
        ? {
            ...actionLabels,
            [DialFileManagerActions.Preview]: labels.previewLabel,
          }
        : actionLabels;
    if (!(DialFileManagerActions.Info in tabActionLabels)) return withPreview;
    return {
      ...withPreview,
      [DialFileManagerActions.Info]: labels.infoLabel,
    };
  }, [actionLabels, tabActionLabels, labels.infoLabel, labels.previewLabel]);

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

  const isAttachVariant = variant === DialFileManagerVariant.Attach;

  const gridOptions = useMemo(
    () => ({
      selectionMode: GridSelectionMode.MULTIPLE,
      /* Attach is a picker: column filters are redundant next to the search bar. */
      ...(isAttachVariant ? { filterable: false } : {}),
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
      isAttachVariant,
      visibleColumns,
      dateLocale,
      dateOptions,
      gridActionLabels,
      isRowSelectable,
    ],
  );

  const treeOptions = useMemo(
    () => ({
      header:
        variant === DialFileManagerVariant.Attach
          ? null
          : labels.treeHeaderByTab[activeTab],
      containerClassName:
        treeContainerClassName ??
        (variant === DialFileManagerVariant.Attach
          ? 'min-h-0 h-full w-[360px] shrink-0 rounded-xl bg-layer-raised shadow-sm'
          : undefined),
      tabsAriaLabel: labels.treeHeaderByTab[activeTab],
      tabs,
      activeTab,
      onTabChange,
      expandedPaths,
      loadedPaths,
      loadingPaths: folderPopupLoadingPaths,
      onExpandedPathsChange,
      actionLabels,
    }),
    [
      labels.treeHeaderByTab,
      treeContainerClassName,
      variant,
      tabs,
      activeTab,
      onTabChange,
      expandedPaths,
      loadedPaths,
      folderPopupLoadingPaths,
      onExpandedPathsChange,
      actionLabels,
    ],
  );

  const showUploadArchiveAction =
    variant === DialFileManagerVariant.Standalone &&
    actionProfile === DialFileManagerActionProfile.Full &&
    gateTab === DialFileManagerTabs.MyFiles &&
    uploadEnabled;

  const toolbarOptions = useMemo(
    () => ({
      showHiddenFilesToggle: true,
      /* The attach footer owns the primary action, so the "Add" button is neutral. */
      ...(isAttachVariant ? { newButtonVariant: ButtonVariant.Neutral } : {}),
      hiddenFilesSwitcherLabel: labels.hiddenFilesLabel,
      showHiddenFilesLabel: labels.showHiddenFilesLabel,
      hideHiddenFilesLabel: labels.hideHiddenFilesLabel,
      isNewButtonDisabled,
      disabledNewButtonTooltip,
      newActions: {
        uploadFiles: { label: labels.uploadFilesLabel, icon: null },
        newFolder: { label: labels.newFolderLabel, icon: null },
        ...(showUploadArchiveAction
          ? { uploadArchive: { label: labels.uploadArchiveAction, icon: null } }
          : {}),
      },
    }),
    [
      isAttachVariant,
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

  /* Attach is a file picker: bulk Download/Delete would act on files the user only meant to pick. */
  const bulkActionsToolbarOptions = useMemo(
    () =>
      isAttachVariant
        ? undefined
        : {
            getSelectionLabel: labels.getSelectionLabel,
            actionLabels: bulkActionLabels,
          },
    [isAttachVariant, labels.getSelectionLabel, bulkActionLabels],
  );

  const deleteConfirmationOptions = useMemo(
    () => ({
      cancelLabel: labels.deleteCancelLabel,
      confirmLabel: labels.deleteConfirmLabel,
      closeLabel: labels.deleteCloseLabel,
      titleRenderer: labels.deleteConfirmTitle,
      contentRenderer: labels.deleteConfirmBody,
    }),
    [
      labels.deleteCancelLabel,
      labels.deleteConfirmLabel,
      labels.deleteCloseLabel,
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
    folderPopupLoadingPaths.has(destinationFolderPath);

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
      movedIntoItselfTooltip: labels.movedIntoItselfTooltip,
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
      labels.movedIntoItselfTooltip,
      labels.folderPickerEmptyStateTitle,
      labels.folderPickerEmptyStateDescription,
      isDestinationFolderLoading,
      disabledDestinationPath,
      destinationFolderPath,
    ],
  );

  /* The queue confirms first when work is still running, so closing it aborts whatever is left. */
  /* One queue for both kinds: closing it stops and clears uploads and downloads alike. */
  const handleTransferQueueClose = useCallback((): void => {
    cancelUpload();
    cancelAllDownloads();
    clearUploadBatch();
    clearDownloadBatch();
  }, [cancelUpload, cancelAllDownloads, clearUploadBatch, clearDownloadBatch]);

  const handleCancelTransferItem = useCallback(
    (rowId: string): void => {
      const row = parseTransferQueueRowId(rowId);
      if (row?.kind === TransferQueueRowKind.Upload) {
        cancelUploadFile(row.entryId);
      } else if (row?.kind === TransferQueueRowKind.Download) {
        cancelDownloadFile(row.entryId);
      }
    },
    [cancelUploadFile, cancelDownloadFile],
  );

  const transferQueueItems = useMemo(
    () =>
      toTransferQueueItems(
        uploadBatchState,
        downloadBatchState,
        labels.uploadFailureMessages,
      ),
    [uploadBatchState, downloadBatchState, labels.uploadFailureMessages],
  );

  const uploadCount = uploadBatchState?.files.length ?? 0;
  const downloadCount = downloadBatchState?.files.length ?? 0;
  const transferQueueTitle =
    labels.getTransferQueueTitle?.({
      uploads: uploadCount,
      downloads: downloadCount,
    }) ?? labels.getUploadQueueTitle(uploadCount + downloadCount);

  const transferQueueLabels = useMemo(
    () =>
      buildTransferQueueLabels({
        uploadLabels: labels.uploadQueueLabels,
        downloadLabels: labels.downloadQueueLabels,
        mixedProgressLabel: labels.transferQueueProgressAriaLabel,
        uploadNames: new Set(uploadBatchState?.files.map((file) => file.name)),
        downloadNames: new Set(
          downloadBatchState?.files.map((file) => file.name),
        ),
      }),
    [
      labels.uploadQueueLabels,
      labels.downloadQueueLabels,
      labels.transferQueueProgressAriaLabel,
      uploadBatchState,
      downloadBatchState,
    ],
  );

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
      isDeleting,
      isRenaming,
      isMoving,
      isUnsharing,
      isRemovingAccess,
    },
    labels,
  );

  /* Search-mode copy goes through `searchEmptyStateTitle`: in search mode
     `DialFileManager` ignores `emptyStateTitle` and falls back to "No data". */
  const emptyStateCopy = useMemo((): EmptyStateCopy => {
    const isInSubfolder = path.split('/').filter(Boolean).length > 1;
    if (isInSubfolder) {
      return { title: labels.folderEmptyStateTitle, description: '' };
    }
    return labels.emptyStateByTab[gateTab];
  }, [path, labels.folderEmptyStateTitle, labels.emptyStateByTab, gateTab]);

  const surfaceCssVars = buildCssVars({
    '--dfms-surface': shellStyles?.colors?.surface,
  });

  return (
    <>
      {error != null ? (
        <div role="alert" className="flex flex-col items-center gap-4 p-6">
          <p>{labels.errorMessage}</p>
          <PrimaryButton label={labels.retryLabel} onClick={retry} />
        </div>
      ) : (
        <div
          style={surfaceCssVars}
          className={mergeClasses(
            'relative flex min-h-0 w-full grow overflow-auto',
            styles.surface,
          )}
        >
          <DialFileManager
            /* Cancels the file manager's own compact-view root padding, which doubles attach's grid inset. */
            className={mergeClasses(
              'min-h-0 w-full grow',
              styles.surface,
              isAttachVariant && 'p-0',
            )}
            contentClassName={
              variant === DialFileManagerVariant.Attach
                ? 'px-0 pb-0'
                : undefined
            }
            gridClassName={
              variant === DialFileManagerVariant.Attach
                ? 'size-full gap-6 px-6 py-4'
                : 'size-full'
            }
            items={items}
            path={path}
            onPathChange={onPathChange}
            onGridApiChange={handleGridApiChange}
            filesLoading={isLoading}
            allowedFileTypes={allowedFileTypes}
            maxSelectableFileSize={maxSelectableFileSize}
            maxFileSize={maxSelectableFileSize}
            uploadValidationMessages={
              oversizedUploadMessage != null
                ? { oversizedFiles: oversizedUploadMessage }
                : undefined
            }
            selectedPaths={selectedPaths}
            onSelectedPathsChange={onSelectedPathsChange}
            navigationPanelOptions={{
              searchable: true,
              placeholder: labels.searchPlaceholderByTab?.[gateTab],
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
            searchEmptyStateTitle={labels.searchEmptyStateTitle}
            uploadEnabled={uploadEnabled}
            sharedWithMeIds={sharedWithMeIds}
            sharedByMePaths={sharedByMePaths}
            onUnshareFiles={onUnshareFiles}
            onRemoveFilesAccess={onRemoveFilesAccess}
            fileMetadataPopupOptions={fileMetadataPopupOptions}
            onGetInfo={onGetInfo}
            onPreview={onPreview}
            previewExtensions={previewExtensions}
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
              className="absolute inset-0 z-52 flex items-center justify-center bg-backdrop desktop:p-4"
            >
              <Spinner size={32} fullWidth={false} ariaLabel={overlayLabel} />
            </div>
          )}
        </div>
      )}

      {/*
       * Above page content (sidebars sit at z-50) but below the kit's portalled
       * overlays — popup 52, dropdown 53, tooltip 55 — so a row's error tooltip
       * and the close confirmation open over the queue, not under it.
       */}
      <div className="fixed inset-e-4 bottom-4 z-51">
        <TransferQueue
          title={transferQueueTitle}
          items={transferQueueItems}
          onClose={handleTransferQueueClose}
          onCancelItem={handleCancelTransferItem}
          labels={transferQueueLabels}
        />
      </div>

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
