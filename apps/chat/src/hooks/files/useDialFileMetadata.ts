import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { getFileMetadata } from '../../server-api/files.api';
import { resolveDialFileApiPath } from '../../utils/resolve-dial-file-api-path';
import { mapFileMetadataToDialFile } from './dial-file-manager-mapping.util';

export interface UseDialFileMetadataOptions {
  bucket: string;
  rootLabel: string;
  onNotification?: (notification: {
    variant: NotificationVariant;
    title?: string;
    message: string;
  }) => void;
}

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
  bucket,
  rootLabel,
  onNotification,
}: UseDialFileMetadataOptions): UseDialFileMetadataResult => {
  const { t } = useTranslation();

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
          const metadata = await getFileMetadata({
            bucket: itemBucket,
            path: itemPath,
          });
          setFileMetadata(mapFileMetadataToDialFile(metadata, file));
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            message: t(DialFileManagerI18nKeys.GetInfoError),
          });
        } finally {
          setIsFileMetadataLoading(false);
        }
      };
      void run();
    },
    [bucket, rootLabel, onNotification, t],
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
