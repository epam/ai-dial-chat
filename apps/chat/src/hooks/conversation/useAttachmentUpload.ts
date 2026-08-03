import {
  AttachmentErrorReason,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useRef } from 'react';
import { NETWORK_ERROR_DEBOUNCE_MS } from '../../constants/upload';
import { uploadFile } from '../../server-api/files.api';
import { buildUploadPath } from '../../utils/build-upload-path';

interface Params {
  bucket: string | undefined;
  /** Called with batched filenames after a burst of network-error upload failures. */
  onNetworkError?: (filenames: string[]) => void;
}

interface Result {
  handleUploadAttachment: (attachment: Attachment) => Promise<string>;
}

export const useAttachmentUpload = ({
  bucket,
  onNetworkError,
}: Params): Result => {
  const pendingNetworkFilesRef = useRef<string[]>([]);
  const networkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUploadAttachment = useCallback(
    async (attachment: Attachment): Promise<string> => {
      if (!bucket) {
        throw new Error('User bucket is not available');
      }
      try {
        const response = await uploadFile(
          bucket,
          buildUploadPath(attachment.name),
          attachment.file,
        );
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
          }, NETWORK_ERROR_DEBOUNCE_MS);

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
    [bucket, onNetworkError],
  );

  return { handleUploadAttachment };
};
