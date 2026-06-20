import {
  DialFileManager,
  DialFileManagerActions,
  DialFileNodeType,
  DialPopup,
  DialPrimaryButton,
  DialLoader,
  GridSelectionMode,
  NotificationVariant,
  PopupSize,
  type DialFile,
  type FileManagerGridRow,
} from '@epam/ai-dial-ui-kit';
import {
  memo,
  type FC,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { useDialFileManager } from '../../hooks/files/useDialFileManager';
import {
  isMimeTypeAllowed,
  mimeTypesToExtensionLabels,
} from '../../utils/attachment-mime';
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
}) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const {
    items,
    isLoading,
    error,
    path,
    onPathChange,
    retry,
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
    downloadError,
    clearDownloadError,
    onDeleteFiles,
    isDeleting,
    deleteError,
    clearDeleteError,
    uploadEnabled,
    isNewButtonDisabled,
    disabledNewButtonTooltip,
  } = useDialFileManager({ bucket });

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
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
    return result;
  }, [items]);

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

    onAttach({ files: dedupedFiles, folderPaths: dedupedFolderPaths });
  }, [
    onAttach,
    selectedFiles,
    allowedTypes,
    maximumAttachmentsAmount,
    showNotification,
    t,
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

  const uploadProgressText = useMemo(() => {
    if (uploadBatchState == null) {
      return '';
    }

    const done = uploadBatchState.files.filter(
      (file) => file.status !== FileUploadStatus.Uploading,
    ).length;

    return t('dialFileManager.uploadProgressSummary', {
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
    isDownloading || isDeleting || isCreatingFolder || uploadBatchState != null;

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

  const gridOptions = useMemo(
    () => ({
      selectionMode: GridSelectionMode.MULTIPLE,
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
      actionLabels: {
        [DialFileManagerActions.Download]: downloadLabel,
        [DialFileManagerActions.Delete]: deleteLabel,
      },
    }),
    [
      downloadLabel,
      deleteLabel,
      allowedTypes,
      maxSelectableFileSize,
      canAttachFolders,
    ],
  );

  const treeOptions = useMemo(
    () => ({
      actionLabels: {
        [DialFileManagerActions.Download]: downloadLabel,
        [DialFileManagerActions.Delete]: deleteLabel,
      },
    }),
    [downloadLabel, deleteLabel],
  );

  const toolbarOptions = useMemo(
    () => ({
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
      actionLabels: {
        [DialFileManagerActions.Download]: downloadLabel,
        [DialFileManagerActions.Delete]: deleteLabel,
      },
    }),
    [getSelectionLabel, downloadLabel, deleteLabel],
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
              selectedPaths={selectedPaths}
              onSelectedPathsChange={setSelectedPaths}
              navigationPanelOptions={{
                searchable: false,
              }}
              gridOptions={gridOptions}
              treeOptions={treeOptions}
              toolbarOptions={toolbarOptions}
              bulkActionsToolbarOptions={bulkActionsToolbarOptions}
              emptyStateTitle={emptyTitle}
              emptyStateDescription={emptyDescription}
              uploadEnabled={uploadEnabled}
              onUploadFiles={onUploadFiles}
              onValidateUpload={onValidateUpload}
              onCreateFolder={onCreateFolder}
              onCreateFolderValidate={onCreateFolderValidate}
              onDownloadFiles={onDownloadFiles}
              onDeleteFiles={onDeleteFiles}
              deleteConfirmationOptions={deleteConfirmationOptions}
              getDisabledTooltip={getDisabledTooltip}
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
            {downloadError != null && !isDownloading && (
              <button
                type="button"
                role="alert"
                className="absolute inset-x-4 bottom-4 z-10 rounded bg-error px-4 py-3 text-start text-sm text-primary shadow"
                onClick={clearDownloadError}
              >
                {downloadError}
              </button>
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
            {deleteError != null && !isDeleting && (
              <button
                type="button"
                role="alert"
                className="absolute inset-x-4 bottom-4 z-10 rounded bg-error px-4 py-3 text-start text-sm text-primary shadow"
                onClick={clearDeleteError}
              >
                {deleteError}
              </button>
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
