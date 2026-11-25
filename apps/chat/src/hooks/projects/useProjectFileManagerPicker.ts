import { resolveDialFileApiPath } from '@epam/ai-dial-chat-hooks';
import { useSkillFileSystemPicker } from '@epam/ai-dial-chat-hooks/skill-editor';
import { formatFileSize, type AttachResult } from '@epam/ai-dial-chat-shared';
import {
  getContextFilesSize,
  type ContextFileLimits,
  type ProjectContextFile,
} from '@epam/ai-dial-projects';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { useTranslation } from 'react-i18next';
import {
  DialFileManagerI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { downloadFile } from '../../server-api/files.api';

class ProjectFileSizeError extends Error {}

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
  contextFiles: ProjectContextFile[],
  {
    maxFileBytes,
    maxTotalBytes,
  }: Pick<ContextFileLimits, 'maxFileBytes' | 'maxTotalBytes'>,
): UseProjectFileManagerPickerResult => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  const remainingBytes = maxTotalBytes - getContextFilesSize(contextFiles);
  /* Parallel downloads in one selection share an abort signal and a byte budget. */
  const downloadedBytes = new WeakMap<AbortSignal, number>();
  const capacityError = (name: string) =>
    t(ProjectsI18nKeys.CreateErrorCapacityExceeded, { name });
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
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let fileBytes = 0;
      const reader = response.body?.getReader();
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileBytes += value.byteLength;
            if (fileBytes > maxFileBytes) {
              throw new ProjectFileSizeError(
                t(ProjectsI18nKeys.CreateErrorTooLarge, {
                  name: file.name,
                  maxSize: formatFileSize(maxFileBytes),
                }),
              );
            }
            const total = (downloadedBytes.get(signal) ?? 0) + value.byteLength;
            if (total > remainingBytes) {
              throw new ProjectFileSizeError(capacityError(file.name));
            }
            downloadedBytes.set(signal, total);
            chunks.push(new Uint8Array(value));
          }
        } finally {
          reader.releaseLock();
        }
      }
      return new File(chunks, file.name, {
        type: file.contentType ?? response.headers.get('content-type') ?? '',
      });
    },
    onError: (error) =>
      showErrorNotification({
        message:
          error instanceof ProjectFileSizeError
            ? error.message
            : t(ProjectsI18nKeys.CreateToastFileManagerError),
      }),
  });

  return {
    isOpen: picker.isOpen,
    pickFromFileManager: picker.pickFromFileSystem,
    handleAttach: (selection) => {
      let selectedBytes = 0;
      for (const file of selection.files) {
        if (file.nodeType !== DialFileNodeType.ITEM) continue;
        selectedBytes += file.contentLength ?? 0;
        if (selectedBytes > remainingBytes) {
          showErrorNotification({ message: capacityError(file.name) });
          return;
        }
      }
      picker.handleAttach(selection);
    },
    handleClose: picker.handleClose,
  };
};
