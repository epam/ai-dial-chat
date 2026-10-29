import { resolveDialFileApiPath } from '@epam/ai-dial-chat-hooks';
import {
  useSkillFileSystemPicker as usePicker,
  type UseSkillFileSystemPickerResult as PickerResult,
} from '@epam/ai-dial-chat-hooks/skill-editor';
import type { SkillFileSourceEntry } from '@epam/ai-dial-skill-editor';
import { useTranslation } from 'react-i18next';
import {
  DialFileManagerI18nKeys,
  SkillEditorI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { downloadFile } from '../../server-api/files.api';

/** Parent file-picker result. */
export type UseSkillFileSystemPickerResult = PickerResult<SkillFileSourceEntry>;
/** Adapts host downloads, root labels and notifications to the shared picker. */
export const useSkillFileSystemPicker = (
  bucket: string | undefined,
): UseSkillFileSystemPickerResult => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  return usePicker({
    materializeFile: async (file, signal) => {
      const fileBucket = file.bucket ?? bucket;
      if (!fileBucket) throw new Error('File is missing bucket');
      const response = await downloadFile(
        fileBucket,
        resolveDialFileApiPath(
          file,
          fileBucket,
          t(DialFileManagerI18nKeys.TabMyFiles),
        ),
        signal,
      );
      if (!response.ok)
        throw new Error(`Download failed with status ${response.status}`);
      const blob = await response.blob();
      return {
        path: file.name,
        file: new File([blob], file.name, {
          type: file.contentType ?? blob.type,
        }),
      };
    },
    onError: () =>
      showErrorNotification({
        message: t(SkillEditorI18nKeys.FileSystemDownloadError),
      }),
  });
};
