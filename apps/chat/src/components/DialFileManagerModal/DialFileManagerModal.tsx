import {
  DialFileManager,
  DialFileManagerActions,
  DialFileNodeType,
  DialPopup,
  DialPrimaryButton,
  DialLoader,
  GridSelectionMode,
  PopupSize,
  type DialFile,
  type FileManagerGridRow,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDialFileManager } from '../../hooks/files/useDialFileManager';
import UploadProgressModal from './UploadProgressModal';
import { FileUploadStatus } from './types/upload';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (files: DialFile[]) => void;
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
  uploadProgressTitle: string;
  cancelLabel: string;
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
  uploadProgressTitle,
  cancelLabel,
}) => {
  const { t } = useTranslation();
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
        if (item.nodeType === DialFileNodeType.ITEM) {
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
    onAttach(selectedFiles);
  }, [onAttach, selectedFiles]);

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

  const isOperationInProgress =
    isDownloading || isCreatingFolder || uploadBatchState != null;

  const gridOptions = useMemo(
    () => ({
      selectionMode: GridSelectionMode.MULTIPLE,
      additionalGridOptions: {
        domLayout: 'normal' as const,
        rowSelection: {
          mode: 'multiRow' as const,
          isRowSelectable: (node: { data?: FileManagerGridRow | null }) =>
            node.data?.nodeType === DialFileNodeType.ITEM,
        },
      },
      actionLabels: {
        [DialFileManagerActions.Download]: downloadLabel,
      },
    }),
    [downloadLabel],
  );

  const treeOptions = useMemo(
    () => ({
      actionLabels: {
        [DialFileManagerActions.Download]: downloadLabel,
      },
    }),
    [downloadLabel],
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
      },
    }),
    [getSelectionLabel, downloadLabel],
  );

  return (
    <>
      <DialPopup
        open={isOpen}
        header={title}
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
