import {
  type DialFileManagerShellLabels,
  FileUploadFailureReason,
} from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { useTransferQueueLabels } from '../useTransferQueueLabels';

/** Returns the translated heading, strings and per-reason failure messages of the file manager's upload queue. */
export const useUploadQueueLabels = (): Pick<
  DialFileManagerShellLabels,
  'getUploadQueueTitle' | 'uploadQueueLabels' | 'uploadFailureMessages'
> => {
  const { t } = useTranslation();
  const sharedQueueLabels = useTransferQueueLabels();

  return useMemo(
    () => ({
      getUploadQueueTitle: (count: number) =>
        t(DialFileManagerI18nKeys.UploadQueueTitle, { count }),
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
        [FileUploadFailureReason.TooLarge]: t(
          DialFileManagerI18nKeys.UploadFailedTooLarge,
        ),
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
    [sharedQueueLabels, t],
  );
};
