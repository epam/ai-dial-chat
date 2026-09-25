import type { DialFileManagerShellLabels } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { useTransferQueueLabels } from '../useTransferQueueLabels';

/** Returns the translated heading and strings of the file manager's upload queue. */
export const useUploadQueueLabels = (): Pick<
  DialFileManagerShellLabels,
  'getUploadQueueTitle' | 'uploadQueueLabels'
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
    }),
    [sharedQueueLabels, t],
  );
};
