import { resolveDialFileApiPath } from '@epam/ai-dial-chat-hooks';
import { useSkillFileSystemPicker } from '@epam/ai-dial-chat-hooks/skill-editor';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { useTranslation } from 'react-i18next';
import {
  DialFileManagerI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { downloadFile } from '../../server-api/files.api';

/** Result of {@link useProjectFileManagerPicker}. */
export interface UseProjectFileManagerPickerResult {
  /** Whether the DIAL file-manager modal should be rendered open. */
  isOpen: boolean;
  /** Passed to `ProjectCreateForm` as `onPickFromFileManager`; resolves the picked files, or `undefined` when cancelled. */
  pickFromFileManager: () => Promise<File[] | undefined>;
  /** The modal's `onAttach`: downloads the picked files and resolves the pending pick. */
  handleAttach: (result: AttachResult) => void;
  /** The modal's `onClose`: resolves the pending pick as cancelled. */
  handleClose: () => void;
}

/**
 * Adapts the project form's promise-based "File manager" source to the shared
 * `useSkillFileSystemPicker`, as the skill editor does. The projects lib knows
 * no buckets or routes, so the app edge resolves each picked file's API path
 * and downloads its bytes into a `File` — a copy the form stages like any
 * device upload.
 */
export const useProjectFileManagerPicker = (
  bucket: string | undefined,
): UseProjectFileManagerPickerResult => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  const picker = useSkillFileSystemPicker<File>({
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
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();
      return new File([blob], file.name, {
        type: file.contentType ?? blob.type,
      });
    },
    onError: () =>
      showErrorNotification({
        message: t(ProjectsI18nKeys.CreateToastFileManagerError),
      }),
  });

  return {
    isOpen: picker.isOpen,
    pickFromFileManager: picker.pickFromFileSystem,
    handleAttach: picker.handleAttach,
    handleClose: picker.handleClose,
  };
};
