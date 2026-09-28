import type {
  ListFilesItemDto,
  UploadArchiveEntryResultDto,
} from '@epam/ai-dial-chat-api-client';
import type {
  FileUploadBatchState,
  FileUploadEntry,
} from '@epam/ai-dial-chat-shared';
import { FileUploadStatus } from '@epam/ai-dial-chat-shared';
import type {
  DialFile,
  DialUploadFileItem,
} from '@epam/ai-dial-react-file-manager';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useRef, useState } from 'react';
import { updateEntry } from '../dial-file-manager-mapping.util';
import { resolveOwnerCoords } from '../dial-file-manager-path.util';
import {
  UPLOAD_CONCURRENCY,
  type SharedRootMeta,
} from '../dial-file-manager.model';
import type {
  FileManagerNotification,
  FileUploadValidationResult,
} from '../dial-file-manager.types';
import { FileManagerNotificationReason } from '../dial-file-manager.types';
import { DialFilesApiUploadMode } from '../dial-files-api';
import type { DialFilesApi } from '../dial-files-api';
import { sanitizeFileName } from '../file-name';
import { virtualPathToApiPath } from '../resolve-dial-file-api-path';

const ARCHIVE_FAILED_FILE_LIST_LIMIT = 5;

const formatArchiveFailedEntry = (
  result: UploadArchiveEntryResultDto,
): string => (result.error ? `${result.path} (${result.error})` : result.path);

const formatArchiveFailedNames = (
  failedResults: UploadArchiveEntryResultDto[],
): { names: string[]; restCount: number } => {
  const visibleResults = failedResults.slice(0, ARCHIVE_FAILED_FILE_LIST_LIMIT);
  return {
    names: visibleResults.map(formatArchiveFailedEntry),
    restCount: failedResults.length - visibleResults.length,
  };
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

let entryIdCounter = 0;

/* Unique across batches, since a new batch is appended to one still on screen. */
const createEntryId = (): string => {
  entryIdCounter += 1;
  return `${Date.now()}-${entryIdCounter}`;
};

const appendEntries = (
  prev: FileUploadBatchState | null,
  entries: FileUploadEntry[],
): FileUploadBatchState => ({
  files: [...(prev?.files ?? []), ...entries],
  isOpen: true,
});

/** Options accepted by `useDialFileUploadBatch`. */
export interface UseDialFileUploadBatchOptions {
  /** Injected operation port used for every upload network call. */
  filesApi: DialFilesApi;
  /** DIAL Core bucket to browse (used only for the my_files tab). */
  bucket: string;
  /** Display name for the root folder node. */
  rootLabel: string;
  /** Active tab — drives owner-bucket resolution for the Shared tab. */
  activeTab: DialFileManagerTabs;
  /** Read-only snapshot of `useDialFileListing`'s cache, used to decide overwrite vs. create-only upload mode. */
  cache: Map<string, ListFilesItemDto[]>;
  /** Owner-bucket resolution metadata for the Shared tab, owned by `useDialFileListing`. */
  sharedRootMetaRef: React.RefObject<Map<string, SharedRootMeta>>;
  /** Deletes the given API-path cache keys so the next fetch re-fetches them. */
  invalidateFolders: (apiPaths: string[]) => void;
  /** Forces `useDialFileListing`'s fetch effect to re-run. */
  bumpRetry: () => void;
  /** Called when an upload batch fails or completes and should surface a toast notification. */
  onNotification?: (notification: FileManagerNotification) => void;
}

/** Values returned by `useDialFileUploadBatch`. */
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
  cancelUploadFile: (id: string) => void;
  clearUploadBatch: () => void;
}

/**
 * Manages upload batches (single-file and ZIP-archive extraction), including
 * concurrency-limited progress tracking and per-file abort. A batch started
 * while another is on screen is appended to it, and settled entries stay in
 * `uploadBatchState` until `clearUploadBatch`. Invalidates the shared listing
 * cache for the destination folder through `invalidateFolders`/`bumpRetry`
 * after a batch settles — it never holds its own copy of the cache.
 */
export const useDialFileUploadBatch = ({
  filesApi,
  bucket,
  rootLabel,
  activeTab,
  cache,
  sharedRootMetaRef,
  invalidateFolders,
  bumpRetry,
  onNotification,
}: UseDialFileUploadBatchOptions): UseDialFileUploadBatchResult => {
  const [uploadBatchState, setUploadBatchState] =
    useState<FileUploadBatchState | null>(null);
  /* One controller per file still queued or uploading, keyed by entry id. */
  const abortControllersRef = useRef(new Map<string, AbortController>());

  const uploadArchiveToFolder = useCallback(
    (file: File, name: string, destinationFolder: string) => {
      const destinationApiPath = virtualPathToApiPath(
        destinationFolder,
        rootLabel,
      );
      const entryId = createEntryId();

      setUploadBatchState((prev) =>
        appendEntries(prev, [
          { id: entryId, name, status: FileUploadStatus.Uploading },
        ]),
      );

      const run = async (): Promise<void> => {
        let status = FileUploadStatus.Failed;
        try {
          const { results } = await filesApi.uploadArchive(
            file,
            bucket,
            buildArchiveDestinationPath(destinationApiPath, name),
          );
          const successCount = results.filter((r) => r.success).length;
          const failedResults = results.filter((r) => !r.success);
          const failedCount = failedResults.length;
          const { names, restCount } = formatArchiveFailedNames(failedResults);

          if (results.length > 0 && successCount === 0) {
            onNotification?.({
              variant: NotificationVariant.Error,
              reason: FileManagerNotificationReason.UploadArchiveFailed,
              names,
              restCount,
            });
          } else {
            status = FileUploadStatus.Completed;
            if (failedCount > 0) {
              onNotification?.({
                variant: NotificationVariant.Error,
                reason:
                  FileManagerNotificationReason.UploadArchivePartiallyFailed,
                count: failedCount,
                names,
                restCount,
              });
            }
          }
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.UploadArchiveRequestFailed,
          });
        } finally {
          invalidateFolders([destinationApiPath]);
          bumpRetry();
          setUploadBatchState((prev) =>
            updateEntry(prev, entryId, { status, percent: 100 }),
          );
        }
      };

      void run();
    },
    [bucket, rootLabel, onNotification, filesApi, invalidateFolders, bumpRetry],
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

      const entries: FileUploadEntry[] = files.map((f) => ({
        id: createEntryId(),
        name: f.name,
        status: FileUploadStatus.Queued,
      }));
      const controllers = abortControllersRef.current;
      for (const entry of entries) {
        controllers.set(entry.id, new AbortController());
      }

      setUploadBatchState((prev) => appendEntries(prev, entries));

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
        let canceledCount = 0;

        const worker = async () => {
          while (nextIndex < files.length) {
            const i = nextIndex++;
            const file = files[i];
            const { id } = entries[i];
            const controller = controllers.get(id);

            if (controller == null || controller.signal.aborted) {
              canceledCount += 1;
              controllers.delete(id);
              setUploadBatchState((prev) =>
                updateEntry(prev, id, FileUploadStatus.Cancelled),
              );
              continue;
            }

            setUploadBatchState((prev) =>
              updateEntry(prev, id, {
                status: FileUploadStatus.Uploading,
                percent: 0,
              }),
            );

            const uploadMode = cachedNames.has(file.name.toLowerCase())
              ? DialFilesApiUploadMode.Overwrite
              : DialFilesApiUploadMode.CreateOnly;

            try {
              await filesApi.uploadFile(
                uploadBucket,
                `${uploadBasePath}${file.name}`,
                file.fileContent,
                {
                  signal: controller.signal,
                  uploadMode,
                  onProgress: (percent) => {
                    setUploadBatchState((prev) =>
                      updateEntry(prev, id, {
                        status: FileUploadStatus.Uploading,
                        percent,
                      }),
                    );
                  },
                },
              );
              setUploadBatchState((prev) =>
                updateEntry(prev, id, {
                  status: FileUploadStatus.Completed,
                  percent: 100,
                }),
              );
              successCount += 1;
            } catch {
              let status = FileUploadStatus.Failed;
              if (controller.signal.aborted) {
                status = FileUploadStatus.Cancelled;
                canceledCount += 1;
              } else {
                failedCount += 1;
              }
              setUploadBatchState((prev) => updateEntry(prev, id, status));
            } finally {
              controllers.delete(id);
            }
          }
        };

        await Promise.all(
          Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()),
        );

        /* A batch the user canceled outright gets no toast — the queue already says so. */
        if (canceledCount < files.length) {
          if (successCount === 0 && failedCount > 0) {
            onNotification?.({
              variant: NotificationVariant.Error,
              reason: FileManagerNotificationReason.UploadFailed,
            });
          } else if (successCount > 0) {
            onNotification?.({
              variant: NotificationVariant.Success,
              reason: FileManagerNotificationReason.UploadCompleted,
              folder: uploadBasePath || rootLabel,
            });
          }
        }

        invalidateFolders([destinationApiPath]);
        bumpRetry();
      };

      void processBatch();
    },
    [
      activeTab,
      bucket,
      cache,
      rootLabel,
      onNotification,
      filesApi,
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

  const cancelUploadFile = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
  }, []);

  const cancelUpload = useCallback(() => {
    for (const controller of abortControllersRef.current.values()) {
      controller.abort();
    }
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
    cancelUploadFile,
    clearUploadBatch,
  };
};
