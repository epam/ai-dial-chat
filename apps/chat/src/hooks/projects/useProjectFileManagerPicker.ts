import { resolveDialFileApiPath } from '@epam/ai-dial-chat-hooks';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DialFileManagerI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { downloadFile } from '../../server-api/files.api';

type PickResolver = (files: File[] | undefined) => void;

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
 * Bridges the New project form's promise-based "File manager" source to the
 * app's file-manager modal, as `useSkillFileSystemPicker` does for skills.
 * The projects lib knows no buckets or routes, so the app edge resolves each
 * picked file's API path and downloads its bytes into a `File` — a copy the
 * form stages like any device upload.
 */
export const useProjectFileManagerPicker = (
  bucket: string | undefined,
): UseProjectFileManagerPickerResult => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const resolverRef = useRef<PickResolver | null>(null);

  const settle = useCallback((files: File[] | undefined) => {
    resolverRef.current?.(files);
    resolverRef.current = null;
  }, []);

  // A pick still pending on unmount must not leave the form awaiting forever.
  useEffect(() => () => settle(undefined), [settle]);

  const pickFromFileManager = useCallback(
    () =>
      new Promise<File[] | undefined>((resolve) => {
        settle(undefined);
        resolverRef.current = resolve;
        setIsOpen(true);
      }),
    [settle],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    settle(undefined);
  }, [settle]);

  const handleAttach = useCallback(
    (result: AttachResult) => {
      setIsOpen(false);
      const rootLabel = t(DialFileManagerI18nKeys.TabMyFiles);
      const picked = result.files.filter(
        (file) => file.nodeType === DialFileNodeType.ITEM,
      );
      const download = async (): Promise<File[]> =>
        Promise.all(
          picked.map(async (file) => {
            const fileBucket = file.bucket ?? bucket;
            if (!fileBucket) throw new Error('File is missing bucket');
            const response = await downloadFile(
              fileBucket,
              resolveDialFileApiPath(file, fileBucket, rootLabel),
            );
            if (!response.ok) {
              throw new Error(`Download failed with status ${response.status}`);
            }
            const blob = await response.blob();
            return new File([blob], file.name, {
              type: file.contentType ?? blob.type,
            });
          }),
        );
      void (async () => {
        try {
          settle(await download());
        } catch {
          showErrorNotification({
            message: t(ProjectsI18nKeys.CreateToastFileManagerError),
          });
          settle(undefined);
        }
      })();
    },
    [bucket, settle, showErrorNotification, t],
  );

  return { isOpen, pickFromFileManager, handleAttach, handleClose };
};
