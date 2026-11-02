import {
  type DialFileManagerShellLabels,
  FileUploadFailureReason,
} from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { useTransferQueueLabels } from '../useTransferQueueLabels';
import { useMaxUploadFileSizeLabel } from './useMaxUploadFileSizeLabel';

/** Returns the translated headings, strings and per-reason failure messages of the file manager's transfer queue (uploads and downloads). */
export const useUploadQueueLabels = (): Pick<
  DialFileManagerShellLabels,
  | 'getUploadQueueTitle'
  | 'uploadQueueLabels'
  | 'uploadFailureMessages'
  | 'getTransferQueueTitle'
  | 'downloadQueueLabels'
  | 'transferQueueProgressAriaLabel'
> => {
  const { t } = useTranslation();
  const sharedQueueLabels = useTransferQueueLabels();
  const maxUploadSize = useMaxUploadFileSizeLabel();

  return useMemo(
    () => ({
      getUploadQueueTitle: (count: number) =>
        t(DialFileManagerI18nKeys.UploadQueueTitle, { count }),
      getTransferQueueTitle: ({ uploads, downloads }) => {
        if (downloads === 0) {
          return t(DialFileManagerI18nKeys.UploadQueueTitle, {
            count: uploads,
          });
        }
        if (uploads === 0) {
          return t(DialFileManagerI18nKeys.DownloadQueueTitle, {
            count: downloads,
          });
        }
        return t(DialFileManagerI18nKeys.TransferQueueTitle, {
          count: uploads + downloads,
        });
      },
      downloadQueueLabels: {
        cancelItemAriaLabel: (fileName: string) =>
          t(DialFileManagerI18nKeys.DownloadQueueCancelFileAriaLabel, {
            fileName,
          }),
        itemProgressAriaLabel: (fileName: string) =>
          t(DialFileManagerI18nKeys.DownloadQueueFileProgressAriaLabel, {
            fileName,
          }),
        queueProgressAriaLabel: t(
          DialFileManagerI18nKeys.DownloadQueueProgressAriaLabel,
        ),
      },
      transferQueueProgressAriaLabel: t(
        DialFileManagerI18nKeys.TransferQueueProgressAriaLabel,
      ),
      uploadQueueLabels: {
        ...sharedQueueLabels,
        cancelItemAriaLabel: (fileName) =>
          t(DialFileManagerI18nKeys.UploadQueueCancelFileAriaLabel, {
            fileName,
          }),
        itemProgressAriaLabel: (fileName) =>
          t(DialFileManagerI18nKeys.UploadQueueFileProgressAriaLabel, {
            fileName,
          }),
        failedMessage: t(DialFileManagerI18nKeys.UploadFailed),
        queueProgressAriaLabel: t(
          DialFileManagerI18nKeys.UploadQueueProgressAriaLabel,
        ),
      },
      /* `Unknown` is left out, so it shows the generic `failedMessage`. */
      uploadFailureMessages: {
        [FileUploadFailureReason.Conflict]: t(
          DialFileManagerI18nKeys.UploadConflict,
        ),
        [FileUploadFailureReason.TooLarge]:
          maxUploadSize != null
            ? t(DialFileManagerI18nKeys.UploadFileTooLarge, {
                maxSize: maxUploadSize,
              })
            : t(DialFileManagerI18nKeys.UploadFailedTooLarge),
        [FileUploadFailureReason.Forbidden]: t(
          DialFileManagerI18nKeys.NoPermissionToCreate,
        ),
        [FileUploadFailureReason.Unavailable]: t(
          DialFileManagerI18nKeys.UploadFailedUnavailable,
        ),
        [FileUploadFailureReason.Network]: t(
          DialFileManagerI18nKeys.CheckInternetConnection,
        ),
      },
    }),
    [maxUploadSize, sharedQueueLabels, t],
  );
};
