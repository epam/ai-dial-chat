import type {
  ListFilesItemDto,
  UploadArchiveEntryResultDto,
} from '@epam/ai-dial-chat-api-client';
import type {
  DialFile,
  DialUploadFileItem,
} from '@epam/ai-dial-react-file-manager';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  FileUploadBatchState,
  FileUploadEntry,
} from '../../components/DialFileManagerModal/types/upload';
import { FileUploadStatus } from '../../components/DialFileManagerModal/types/upload';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { uploadArchive, uploadFile } from '../../server-api/files.api';
import { sanitizeFileName } from '../../utils/file-name';
import { virtualPathToApiPath } from '../../utils/resolve-dial-file-api-path';
import { updateEntry } from './dial-file-manager-mapping.util';
import { resolveOwnerCoords } from './dial-file-manager-path.util';
import {
  UPLOAD_CONCURRENCY,
  type SharedRootMeta,
} from './dial-file-manager.model';

interface FileUploadValidationResult {
  valid: boolean;
  message?: string;
}

const ARCHIVE_FAILED_FILE_LIST_LIMIT = 5;

const formatArchiveFailedEntry = (
  result: UploadArchiveEntryResultDto,
): string => (result.error ? `${result.path} (${result.error})` : result.path);

const formatArchiveFailedEntries = (
  failedResults: UploadArchiveEntryResultDto[],
  getRestLabel: (count: number) => string,
): string => {
  const visibleResults = failedResults.slice(0, ARCHIVE_FAILED_FILE_LIST_LIMIT);
  const visible = visibleResults.map(formatArchiveFailedEntry).join(', ');
  const hiddenCount = failedResults.length - visibleResults.length;

  return hiddenCount > 0 ? `${visible}${getRestLabel(hiddenCount)}` : visible;
};

const buildArchiveDestinationPath = (
  destinationApiPath: string,
  archiveName: string,
): string => `${destinationApiPath}${archiveName}/`;

const hasZipExtension = (name: string): boolean => /\.zip$/i.test(name);

const getArchiveConflictUploadFallback = (
  files: DialUploadFileItem[],
): DialUploadFileItem | undefined => {
  const [file] = files;

  if (files.length !== 1 || file == null) {
    return undefined;
  }

  return hasZipExtension(file.fileContent.name) && !hasZipExtension(file.name)
    ? file
    : undefined;
};

export interface UseDialFileUploadBatchOptions {
  bucket: string;
  rootLabel: string;
  activeTab: DialFileManagerTabs;
  /** Read-only snapshot of `useDialFileListing`'s cache, used to decide overwrite vs create-only upload mode. */
  cache: Map<string, ListFilesItemDto[]>;
  /** Owner-bucket resolution metadata for the Shared tab, owned by `useDialFileListing`. */
  sharedRootMetaRef: React.RefObject<Map<string, SharedRootMeta>>;
  invalidateFolders: (apiPaths: string[]) => void;
  bumpRetry: () => void;
  onNotification?: (notification: {
    variant: NotificationVariant;
    title?: string;
    message: string;
  }) => void;
}

export interface UseDialFileUploadBatchResult {
  onUploadFiles: (
    files: DialUploadFileItem[],
    destinationFolder: string,
  ) => void;
  onUploadArchive: (
    file: File,
    name: string,
    destinationFolder: string,
  ) => void;
  onValidateUpload: (
    files: DialUploadFileItem[],
    existingFiles: DialFile[],
    destinationFolder: string,
  ) => Promise<FileUploadValidationResult>;
  uploadBatchState: FileUploadBatchState | null;
  cancelUpload: () => void;
  clearUploadBatch: () => void;
}

/**
 * Manages upload batches (single-file and ZIP-archive extraction), including
 * concurrency-limited progress tracking and abort. Invalidates the shared
 * listing cache for the destination folder through `invalidateFolders`/
 * `bumpRetry` after a batch settles — it never holds its own copy of the
 * cache (design.md D1).
 */
export const useDialFileUploadBatch = ({
  bucket,
  rootLabel,
  activeTab,
  cache,
  sharedRootMetaRef,
  invalidateFolders,
  bumpRetry,
  onNotification,
}: UseDialFileUploadBatchOptions): UseDialFileUploadBatchResult => {
  const { t } = useTranslation();

  const [uploadBatchState, setUploadBatchState] =
    useState<FileUploadBatchState | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  const uploadArchiveToFolder = useCallback(
    (file: File, name: string, destinationFolder: string) => {
      const destinationApiPath = virtualPathToApiPath(
        destinationFolder,
        rootLabel,
      );

      setUploadBatchState({
        files: [
          {
            id: `${Date.now()}-archive`,
            name,
            status: FileUploadStatus.Uploading,
          },
        ],
        isOpen: true,
      });

      const run = async (): Promise<void> => {
        try {
          const { results } = await uploadArchive(
            file,
            bucket,
            buildArchiveDestinationPath(destinationApiPath, name),
          );
          const successCount = results.filter((r) => r.success).length;
          const failedResults = results.filter((r) => !r.success);
          const failedCount = failedResults.length;
          const failedFiles = formatArchiveFailedEntries(
            failedResults,
            (count) => t(DialFileManagerI18nKeys.AndOtherItems, { count }),
          );

          if (results.length > 0 && successCount === 0) {
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(DialFileManagerI18nKeys.UploadArchiveFilesError, {
                count: failedCount,
                files: failedFiles,
              }),
            });
          } else if (failedCount > 0) {
            onNotification?.({
              variant: NotificationVariant.Error,
              message: t(DialFileManagerI18nKeys.UploadArchivePartialError, {
                count: failedCount,
                files: failedFiles,
              }),
            });
          }
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            message: t(DialFileManagerI18nKeys.UploadArchiveError),
          });
        } finally {
          invalidateFolders([destinationApiPath]);
          bumpRetry();
          setUploadBatchState(null);
        }
      };

      void run();
    },
    [bucket, rootLabel, onNotification, t, invalidateFolders, bumpRetry],
  );

  const onUploadFiles = useCallback(
    (files: DialUploadFileItem[], destinationFolder: string) => {
      if (files.length === 0) return;

      const archiveConflictFile = getArchiveConflictUploadFallback(files);
      if (archiveConflictFile != null) {
        uploadArchiveToFolder(
          archiveConflictFile.fileContent,
          archiveConflictFile.name,
          destinationFolder,
        );
        return;
      }

      const controller = new AbortController();
      uploadAbortControllerRef.current = controller;

      const entries: FileUploadEntry[] = files.map((f, i) => ({
        id: `${Date.now()}-${i}`,
        name: f.name,
        status: FileUploadStatus.Queued,
      }));

      setUploadBatchState({ files: entries, isOpen: true });

      const destinationApiPath = virtualPathToApiPath(
        destinationFolder,
        rootLabel,
      );
      const { bucket: uploadBucket, path: uploadBasePath } =
        activeTab === DialFileManagerTabs.Shared
          ? resolveOwnerCoords(
              destinationApiPath,
              sharedRootMetaRef.current,
              bucket,
            )
          : { bucket, path: destinationApiPath };

      const cachedNames = new Set(
        (cache.get(destinationApiPath) ?? []).map((item) =>
          item.name.toLowerCase(),
        ),
      );

      const processBatch = async () => {
        let nextIndex = 0;
        let successCount = 0;
        let failedCount = 0;

        const worker = async () => {
          while (nextIndex < files.length) {
            const i = nextIndex++;
            const file = files[i];

            if (controller.signal.aborted) {
              setUploadBatchState((prev) =>
                updateEntry(prev, i, FileUploadStatus.Cancelled),
              );
              continue;
            }

            setUploadBatchState((prev) =>
              updateEntry(prev, i, {
                status: FileUploadStatus.Uploading,
                percent: 0,
              }),
            );

            const uploadMode = cachedNames.has(file.name.toLowerCase())
              ? 'overwrite'
              : 'create-only';

            try {
              await uploadFile(
                uploadBucket,
                `${uploadBasePath}${file.name}`,
                file.fileContent,
                {
                  signal: controller.signal,
                  uploadMode,
                  onProgress: (percent) => {
                    setUploadBatchState((prev) =>
                      updateEntry(prev, i, {
                        status: FileUploadStatus.Uploading,
                        percent,
                      }),
                    );
                  },
                },
              );
              setUploadBatchState((prev) =>
                updateEntry(prev, i, {
                  status: FileUploadStatus.Completed,
                  percent: 100,
                }),
              );
              successCount += 1;
            } catch {
              const status = controller.signal.aborted
                ? FileUploadStatus.Cancelled
                : FileUploadStatus.Failed;
              if (status === FileUploadStatus.Failed) {
                failedCount += 1;
              }
              setUploadBatchState((prev) => updateEntry(prev, i, status));
            }
          }
        };

        await Promise.all(
          Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()),
        );

        if (!controller.signal.aborted) {
          if (successCount === 0 && failedCount > 0) {
            onNotification?.({
              variant: NotificationVariant.Error,
              title: t(DialFileManagerI18nKeys.UploadFailed),
              message: t(DialFileManagerI18nKeys.CheckInternetConnection),
            });
          } else {
            onNotification?.({
              variant: NotificationVariant.Success,
              message: t(DialFileManagerI18nKeys.UploadSuccess, {
                parentPath: uploadBasePath || rootLabel,
              }),
            });
          }
        }

        invalidateFolders([destinationApiPath]);
        bumpRetry();
        uploadAbortControllerRef.current = null;
        setUploadBatchState(null);
      };

      void processBatch();
    },
    [
      activeTab,
      bucket,
      cache,
      rootLabel,
      onNotification,
      t,
      sharedRootMetaRef,
      invalidateFolders,
      bumpRetry,
      uploadArchiveToFolder,
    ],
  );

  const onUploadArchive = useCallback(
    (file: File, name: string, destinationFolder: string) => {
      uploadArchiveToFolder(file, name, destinationFolder);
    },
    [uploadArchiveToFolder],
  );

  const onValidateUpload = useCallback(
    async (
      files: DialUploadFileItem[],
      _existingFiles: DialFile[],
      _destinationFolder: string,
    ): Promise<FileUploadValidationResult> => {
      for (const file of files) {
        file.name = sanitizeFileName(file.name);
      }
      return { valid: true };
    },
    [],
  );

  const cancelUpload = useCallback(() => {
    uploadAbortControllerRef.current?.abort();
  }, []);

  const clearUploadBatch = useCallback(() => {
    setUploadBatchState(null);
  }, []);

  return {
    onUploadFiles,
    onUploadArchive,
    onValidateUpload,
    uploadBatchState,
    cancelUpload,
    clearUploadBatch,
  };
};
