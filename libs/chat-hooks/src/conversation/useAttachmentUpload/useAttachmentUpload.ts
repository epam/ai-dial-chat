import type { FilesApi } from '@epam/ai-dial-chat-api-client';
import {
  AttachmentErrorReason,
  type Attachment,
  type UploadedAttachmentResult,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useRef } from 'react';
import { sanitizeFileName } from '../../files/file-name';
import type { UploadPathAllocator } from '../conversation-transfer/build-upload-path';
import { createUploadPathAllocator } from '../conversation-transfer/build-upload-path';
import { formatDateYM } from '../conversation-transfer/date';

const DEFAULT_NETWORK_ERROR_DEBOUNCE_MS = 700;

/** How many ` (n)` alternatives an upload tries before giving up on a name the server keeps reporting as taken. */
const CONFLICT_RETRY_LIMIT = 5;

/** Parameters for {@link useAttachmentUpload}. */
export interface UseAttachmentUploadParams {
  /** Already-configured client; optional listing skips stored names after a conflict. */
  filesApi: Pick<FilesApi, 'uploadFile'> & Partial<Pick<FilesApi, 'listFiles'>>;
  /** DIAL Core bucket the file is uploaded into. */
  bucket: string | undefined;
  /** Called with batched filenames after a burst of network-error upload failures. */
  onNetworkError?: (filenames: string[]) => void;
  /** Debounce window, in ms, for coalescing offline-failure batches. Defaults to `700`. */
  debounceMs?: number;
}

/** Return value of {@link useAttachmentUpload}. */
export interface UseAttachmentUploadResult {
  /** Uploads the given attachment's file and resolves to its DIAL Core file URL and stored name. */
  handleUploadAttachment: (
    attachment: Attachment,
  ) => Promise<UploadedAttachmentResult>;
}

/**
 * Reduces a file name to its final `/`-path segment (guarding against
 * directory traversal via a crafted `attachment.name`) and sanitizes any
 * character DIAL Core's file path forbids (the same `sanitizeFileName` the
 * DIAL file manager applies on upload) to `_`, so a name with e.g. `&` or `\`
 * uploads and downloads under a consistent, valid path instead of being
 * silently truncated or rejected later.
 */
const getSafeFileName = (fileName: string): string => {
  const lastSegment = fileName.split('/').filter(Boolean).pop() ?? 'file';
  const sanitized = sanitizeFileName(lastSegment)
    .replace(/\.\.+/g, '.')
    .replace(/^\.+/, '');
  return sanitized || 'file';
};

/** Reports whether `error` is the 409 the BFF returns when a `create-only` upload lands on an existing path. */
const isConflictError = (error: unknown): boolean =>
  error != null &&
  typeof error === 'object' &&
  'response' in error &&
  (error as { response?: { status?: number } }).response?.status === 409;

/**
 * Uploads an attachment's file to DIAL Core storage against an
 * already-configured `FilesApi` instance, giving every upload a collision-free
 * path so no attachment overwrites another, and coalescing a burst of
 * offline/network upload failures into a single debounced callback rather
 * than firing one notification per failed file.
 */
export const useAttachmentUpload = ({
  filesApi,
  bucket,
  onNetworkError,
  debounceMs = DEFAULT_NETWORK_ERROR_DEBOUNCE_MS,
}: UseAttachmentUploadParams): UseAttachmentUploadResult => {
  const pendingNetworkFilesRef = useRef<string[]>([]);
  const networkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allocatorRef = useRef<{
    key: string;
    allocator: UploadPathAllocator;
  } | null>(null);

  /* One allocator per bucket + month folder: names it hands out only need to
   * be free within the folder they are allocated into, and a stale allocator
   * would keep reserving names in a folder uploads no longer land in. */
  const getAllocator = useCallback(
    (bucketName: string, date: Date): UploadPathAllocator => {
      const key = `${bucketName}|${formatDateYM(date)}`;
      if (allocatorRef.current?.key !== key) {
        allocatorRef.current = {
          key,
          allocator: createUploadPathAllocator({ date }),
        };
      }
      return allocatorRef.current.allocator;
    },
    [],
  );

  const handleUploadAttachment = useCallback(
    async (attachment: Attachment): Promise<UploadedAttachmentResult> => {
      if (!bucket) {
        throw new Error('User bucket is not available');
      }
      const safeName = getSafeFileName(attachment.name);
      /* Two attachments sharing a name — two pasted screenshots, or the same
       * name picked from two folders — would otherwise resolve to one storage
       * path, so the later upload replaced the earlier one and the message
       * carried the same file twice. The allocator disambiguates names seen in
       * this session; `create-only` catches the ones it cannot see (a file an
       * earlier session left in the same month folder). On a conflict, list
       * stored names before retrying so old uploads do not exhaust the retry
       * budget, which is reserved for concurrent writers. */
      const allocator = getAllocator(bucket, new Date());
      let attempt = allocator.allocate(safeName);

      for (let retry = 0; ; retry += 1) {
        try {
          const file = attempt.isRenamed
            ? new File([attachment.file], attempt.fileName, {
                type: attachment.file.type,
              })
            : attachment.file;
          const response = await filesApi.uploadFile({
            bucket,
            path: attempt.path,
            file,
            uploadMode: 'create-only',
          });
          return { url: response.url, name: attempt.fileName };
        } catch (err) {
          if (isConflictError(err)) {
            allocator.markTaken(attempt.fileName);
            if (retry < CONFLICT_RETRY_LIMIT) {
              if (filesApi.listFiles) {
                try {
                  const listing = await filesApi.listFiles({
                    bucket,
                    path: attempt.path.slice(0, attempt.path.lastIndexOf('/')),
                  });
                  for (const item of listing.items) {
                    allocator.markTaken(item.name);
                  }
                } catch {
                  /* Listing is best-effort: retain local reservations and
                   * let create-only uploads enforce collision safety. */
                }
              }
              attempt = allocator.allocate(safeName);
              continue;
            }
          } else {
            /* Nothing was stored under this name, so hand it back for the
             * next upload (or for the user's retry of this one). */
            allocator.release(attempt.fileName);
          }

          if (!navigator.onLine) {
            pendingNetworkFilesRef.current.push(attachment.name);
            if (networkTimerRef.current != null) {
              clearTimeout(networkTimerRef.current);
            }
            networkTimerRef.current = setTimeout(() => {
              const filenames = pendingNetworkFilesRef.current.splice(0);
              onNetworkError?.(filenames);
              networkTimerRef.current = null;
            }, debounceMs);

            const error =
              err instanceof Error ? err : new Error('Network upload failed');
            (
              error as Error & { errorReason: AttachmentErrorReason }
            ).errorReason = AttachmentErrorReason.Network;
            throw error;
          }
          throw err;
        }
      }
    },
    [bucket, debounceMs, filesApi, getAllocator, onNetworkError],
  );

  return { handleUploadAttachment };
};
