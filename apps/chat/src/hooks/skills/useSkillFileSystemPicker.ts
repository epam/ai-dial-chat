import { resolveDialFileApiPath } from '@epam/ai-dial-chat-hooks';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import type { SkillFileSourceEntry } from '@epam/ai-dial-skill-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DialFileManagerI18nKeys,
  SkillEditorI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { downloadFile } from '../../server-api/files.api';

type PickResolver = (entries: SkillFileSourceEntry[] | undefined) => void;

/** Result of {@link useSkillFileSystemPicker}. */
export interface UseSkillFileSystemPickerResult {
  /** Whether the DIAL file-manager modal should be rendered open. */
  isOpen: boolean;
  /** Passed to the Skill Editor as `pickFromFileSystem`; resolves with the picked files, or `undefined` when cancelled. */
  pickFromFileSystem: () => Promise<SkillFileSourceEntry[] | undefined>;
  /** The modal's `onAttach`: downloads the picked files and resolves the pending pick. */
  handleAttach: (result: AttachResult) => void;
  /** The modal's `onClose`: resolves the pending pick as cancelled. */
  handleClose: () => void;
}

/**
 * Bridges the Skill Editor's promise-based "Open DIAL file system" action to
 * the app's file-manager modal. The editor library knows no buckets or
 * routes, so the app edge owns the modal, resolves each picked file's bucket
 * and API path, and downloads its bytes into a `File` the editor stages
 * like any device upload.
 */
export const useSkillFileSystemPicker = (
  bucket: string | undefined,
): UseSkillFileSystemPickerResult => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const resolverRef = useRef<PickResolver | null>(null);

  const settle = useCallback((entries: SkillFileSourceEntry[] | undefined) => {
    resolverRef.current?.(entries);
    resolverRef.current = null;
  }, []);

  // A pick still pending on unmount must not leave the editor awaiting forever.
  useEffect(() => () => settle(undefined), [settle]);

  const pickFromFileSystem = useCallback(
    () =>
      new Promise<SkillFileSourceEntry[] | undefined>((resolve) => {
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
      const download = async (): Promise<SkillFileSourceEntry[]> =>
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
            return {
              path: file.name,
              file: new File([blob], file.name, {
                type: file.contentType ?? blob.type,
              }),
            };
          }),
        );
      void (async () => {
        try {
          settle(await download());
        } catch {
          showErrorNotification({
            message: t(SkillEditorI18nKeys.FileSystemDownloadError),
          });
          settle(undefined);
        }
      })();
    },
    [bucket, settle, showErrorNotification, t],
  );

  return { isOpen, pickFromFileSystem, handleAttach, handleClose };
};
