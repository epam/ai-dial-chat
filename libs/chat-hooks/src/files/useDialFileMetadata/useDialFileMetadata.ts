import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useState } from 'react';
import { mapFileMetadataToDialFile } from '../dial-file-manager-mapping.util';
import {
  FileManagerNotificationReason,
  type FileManagerNotification,
} from '../dial-file-manager.types';
import type { DialFilesApi } from '../dial-files-api';
import { resolveDialFileApiPath } from '../resolve-dial-file-api-path';

/** Options accepted by `useDialFileMetadata`. */
export interface UseDialFileMetadataOptions {
  /** Injected operation port used for the metadata network call. */
  filesApi: DialFilesApi;
  /** DIAL Core bucket the current user browses (used only for my_files items). */
  bucket: string;
  /** Display name of the root folder node, used to resolve virtual paths back to API paths. */
  rootLabel: string;
  /** Called with a structured event when the metadata fetch fails. */
  onNotification?: (notification: FileManagerNotification) => void;
}

/** Values returned by `useDialFileMetadata`. */
export interface UseDialFileMetadataResult {
  fileMetadata: DialFile | undefined;
  isFileMetadataLoading: boolean;
  onGetInfo: (file: DialFile) => void;
  clearMetadata: () => void;
}

/**
 * Fetches and holds single-file metadata for `fileMetadataPopupOptions` —
 * the only sub-hook with no interaction with the shared listing cache, since
 * viewing metadata never mutates listing state.
 */
export const useDialFileMetadata = ({
  filesApi,
  bucket,
  rootLabel,
  onNotification,
}: UseDialFileMetadataOptions): UseDialFileMetadataResult => {
  const [fileMetadata, setFileMetadata] = useState<DialFile | undefined>(
    undefined,
  );
  const [isFileMetadataLoading, setIsFileMetadataLoading] = useState(false);

  const onGetInfo = useCallback(
    (file: DialFile) => {
      const run = async () => {
        setIsFileMetadataLoading(true);
        try {
          const itemBucket = file.bucket ?? bucket;
          const itemPath = resolveDialFileApiPath(file, itemBucket, rootLabel);
          const metadata = await filesApi.getFileMetadata({
            bucket: itemBucket,
            path: itemPath,
          });
          setFileMetadata(mapFileMetadataToDialFile(metadata, file));
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.MetadataLoadFailed,
          });
        } finally {
          setIsFileMetadataLoading(false);
        }
      };
      void run();
    },
    [bucket, filesApi, rootLabel, onNotification],
  );

  const clearMetadata = useCallback(() => {
    setFileMetadata(undefined);
    setIsFileMetadataLoading(false);
  }, []);

  return {
    fileMetadata,
    isFileMetadataLoading,
    onGetInfo,
    clearMetadata,
  };
};
