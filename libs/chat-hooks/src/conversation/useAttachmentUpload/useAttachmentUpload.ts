import type { FilesApi } from '@epam/ai-dial-chat-api-client';
import {
  AttachmentErrorReason,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useRef } from 'react';

const DEFAULT_NETWORK_ERROR_DEBOUNCE_MS = 700;

/** Parameters for {@link useAttachmentUpload}. */
export interface UseAttachmentUploadParams {
  /** Already-configured generated-client instance used to upload the file. */
  filesApi: Pick<FilesApi, 'uploadFile'>;
  /** DIAL Core bucket the file is uploaded into. */
  bucket: string | undefined;
  /** Called with batched filenames after a burst of network-error upload failures. */
  onNetworkError?: (filenames: string[]) => void;
  /** Debounce window, in ms, for coalescing offline-failure batches. Defaults to `700`. */
  debounceMs?: number;
}

/** Return value of {@link useAttachmentUpload}. */
export interface UseAttachmentUploadResult {
  /** Uploads the given attachment's file and resolves to its DIAL Core file URL. */
  handleUploadAttachment: (attachment: Attachment) => Promise<string>;
}

/** Decodes a file name to its final path segment, stripping traversal characters. */
const getSafeFileName = (fileName: string): string => {
  const name = fileName.split(/[\\/]/).filter(Boolean).pop() ?? 'file';
  return name.replace(/\.\.+/g, '.').replace(/^\.+/, '') || 'file';
};

/** Builds the `uploads/<YYYY-MM>/<safe-name>` DIAL Core upload path for a file. */
const buildUploadPath = (fileName: string, date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const encodedFileName = encodeURIComponent(getSafeFileName(fileName));
  return `uploads/${year}-${month}/${encodedFileName}`;
};

/**
 * Uploads an attachment's file to DIAL Core storage against an
 * already-configured `FilesApi` instance, coalescing a burst of
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

  const handleUploadAttachment = useCallback(
    async (attachment: Attachment): Promise<string> => {
      if (!bucket) {
        throw new Error('User bucket is not available');
      }
      try {
        const response = await filesApi.uploadFile({
          bucket,
          path: buildUploadPath(attachment.name),
          file: attachment.file,
        });
        return response.url;
      } catch (err) {
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
    },
    [bucket, debounceMs, filesApi, onNetworkError],
  );

  return { handleUploadAttachment };
};
