import {
  type TransferQueueItem,
  TransferQueueItemStatus,
  type TransferQueueLabels,
} from '@epam/ai-dial-ui-kit';
import {
  type FileDownloadBatchState,
  type FileDownloadEntry,
  FileDownloadStatus,
  type FileUploadBatchState,
  type FileUploadEntry,
  type FileUploadFailureReason,
  FileUploadStatus,
} from './upload-batch';

/*
 * Kept out of `upload-batch.ts`, which the root entry re-exports: this is a
 * value import of the kit, so it lives beside the shell in the
 * `./file-manager` entry and a host that never renders the queue never loads it.
 */
const UPLOAD_QUEUE_STATUS: Record<FileUploadStatus, TransferQueueItemStatus> = {
  [FileUploadStatus.Queued]: TransferQueueItemStatus.InProgress,
  [FileUploadStatus.Uploading]: TransferQueueItemStatus.InProgress,
  [FileUploadStatus.Completed]: TransferQueueItemStatus.Success,
  [FileUploadStatus.Failed]: TransferQueueItemStatus.Failed,
  [FileUploadStatus.Cancelled]: TransferQueueItemStatus.Canceled,
};

/** Maps upload entries onto the UI kit's `TransferQueue` rows; a failed row's `message` is the host text for its reason, when there is one. */
export const toUploadQueueItems = (
  files: FileUploadEntry[],
  failureMessages?: Partial<Record<FileUploadFailureReason, string>>,
): TransferQueueItem[] =>
  files.map((file) => ({
    id: file.id,
    name: file.name,
    status: UPLOAD_QUEUE_STATUS[file.status],
    percent: file.percent,
    /* Unset falls back to the queue's generic `failedMessage` label. */
    message:
      file.status === FileUploadStatus.Failed && file.failureReason != null
        ? failureMessages?.[file.failureReason]
        : undefined,
  }));

const DOWNLOAD_QUEUE_STATUS: Record<
  FileDownloadStatus,
  TransferQueueItemStatus
> = {
  [FileDownloadStatus.Downloading]: TransferQueueItemStatus.InProgress,
  [FileDownloadStatus.Completed]: TransferQueueItemStatus.Success,
  [FileDownloadStatus.Failed]: TransferQueueItemStatus.Failed,
  [FileDownloadStatus.Cancelled]: TransferQueueItemStatus.Canceled,
};

/** Kind of a transfer-queue row, carried as its id prefix so cancel routes to the right batch. */
export enum TransferQueueRowKind {
  Upload = 'upload',
  Download = 'download',
}

/** Builds the id of a transfer-queue row from its kind and its batch entry id. */
export const toTransferQueueRowId = (
  kind: TransferQueueRowKind,
  entryId: string,
): string => `${kind}:${entryId}`;

/** Splits a transfer-queue row id back into its kind and batch entry id; `undefined` for an id of neither kind. */
export const parseTransferQueueRowId = (
  rowId: string,
): { kind: TransferQueueRowKind; entryId: string } | undefined => {
  const separator = rowId.indexOf(':');
  const kind = rowId.slice(0, separator);
  if (
    kind !== TransferQueueRowKind.Upload &&
    kind !== TransferQueueRowKind.Download
  ) {
    return undefined;
  }
  return { kind, entryId: rowId.slice(separator + 1) };
};

const toDownloadQueueItem = (
  file: FileDownloadEntry,
  failureMessages?: Partial<Record<FileUploadFailureReason, string>>,
): TransferQueueItem => ({
  id: toTransferQueueRowId(TransferQueueRowKind.Download, file.id),
  name: file.name,
  status: DOWNLOAD_QUEUE_STATUS[file.status],
  percent: file.percent,
  message:
    file.status === FileDownloadStatus.Failed && file.failureReason != null
      ? failureMessages?.[file.failureReason]
      : undefined,
});

/**
 * Maps the upload and download batches onto one UI kit `TransferQueue`:
 * upload rows first, then download rows, each id prefixed by its kind.
 */
export const toTransferQueueItems = (
  uploadBatch: FileUploadBatchState | null,
  downloadBatch: FileDownloadBatchState | null,
  failureMessages?: Partial<Record<FileUploadFailureReason, string>>,
): TransferQueueItem[] => [
  ...toUploadQueueItems(uploadBatch?.files ?? [], failureMessages).map(
    (item) => ({
      ...item,
      id: toTransferQueueRowId(TransferQueueRowKind.Upload, item.id),
    }),
  ),
  ...(downloadBatch?.files ?? []).map((file) =>
    toDownloadQueueItem(file, failureMessages),
  ),
];

/** Row wording for a download row, as `DialFileManagerShellLabels.downloadQueueLabels` carries it. */
type DownloadRowLabels = Partial<
  Pick<
    TransferQueueLabels,
    'cancelItemAriaLabel' | 'itemProgressAriaLabel' | 'queueProgressAriaLabel'
  >
>;

/** Inputs of {@link buildTransferQueueLabels}. */
interface TransferQueueLabelSources {
  /** The upload queue's labels, used for every upload row and as the base. */
  uploadLabels?: Partial<TransferQueueLabels>;
  /** Download-row wording; without it the queue keeps the upload labels. */
  downloadLabels?: DownloadRowLabels;
  /** Name of the aggregate bar while both kinds run. */
  mixedProgressLabel?: string;
  /** File names of the upload rows. */
  uploadNames: ReadonlySet<string>;
  /** File names of the download rows. */
  downloadNames: ReadonlySet<string>;
}

/**
 * The queue's labels with each row's cancel and progress names worded for its
 * own kind (uploading / downloading), since the kit labels a whole queue
 * rather than a row. A name present in both kinds keeps the upload wording.
 * The aggregate bar is named for downloads, uploads, or both.
 */
export const buildTransferQueueLabels = ({
  uploadLabels,
  downloadLabels,
  mixedProgressLabel,
  uploadNames,
  downloadNames,
}: TransferQueueLabelSources): Partial<TransferQueueLabels> | undefined => {
  if (!downloadLabels || downloadNames.size === 0) return uploadLabels;

  const isDownloadRow = (fileName: string) =>
    downloadNames.has(fileName) && !uploadNames.has(fileName);
  const pickRowLabel = (
    uploadLabel: ((fileName: string) => string) | undefined,
    downloadLabel: ((fileName: string) => string) | undefined,
  ) =>
    uploadLabel && downloadLabel
      ? (fileName: string) =>
          isDownloadRow(fileName)
            ? downloadLabel(fileName)
            : uploadLabel(fileName)
      : (uploadLabel ?? downloadLabel);

  const queueProgressAriaLabel =
    uploadNames.size === 0
      ? (downloadLabels.queueProgressAriaLabel ??
        uploadLabels?.queueProgressAriaLabel)
      : (mixedProgressLabel ?? uploadLabels?.queueProgressAriaLabel);
  const cancelItemAriaLabel = pickRowLabel(
    uploadLabels?.cancelItemAriaLabel,
    downloadLabels.cancelItemAriaLabel,
  );
  const itemProgressAriaLabel = pickRowLabel(
    uploadLabels?.itemProgressAriaLabel,
    downloadLabels.itemProgressAriaLabel,
  );

  return {
    ...uploadLabels,
    ...(cancelItemAriaLabel ? { cancelItemAriaLabel } : {}),
    ...(itemProgressAriaLabel ? { itemProgressAriaLabel } : {}),
    ...(queueProgressAriaLabel ? { queueProgressAriaLabel } : {}),
  };
};
