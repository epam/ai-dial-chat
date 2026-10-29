import type { AttachResult } from '@epam/ai-dial-chat-shared';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Host materialization and notification callbacks. */
export interface UseSkillFileSystemPickerOptions<T> {
  /** Converts a selected file into the host's staged entry. */
  materializeFile: (file: DialFile, signal: AbortSignal) => Promise<T>;
  /** Reports a failure of the current selection only. */
  onError: (error: unknown) => void;
}

/** Promise-based file selection controller. */
export interface UseSkillFileSystemPickerResult<T> {
  /** Whether the selection modal is open. */
  isOpen: boolean;
  /** Starts a selection, cancelling any previous attempt. */
  pickFromFileSystem: () => Promise<T[] | undefined>;
  /** Materializes selected files in selection order. */
  handleAttach: (result: AttachResult) => void;
  /** Cancels the current attempt and closes the modal. */
  handleClose: () => void;
}

interface Attempt<T> {
  controller: AbortController;
  resolve: (entries: T[] | undefined) => void;
  attaching: boolean;
}

/** Owns selection lifetime so obsolete downloads cannot settle a newer pick. */
export const useSkillFileSystemPicker = <T>({
  materializeFile,
  onError,
}: UseSkillFileSystemPickerOptions<T>): UseSkillFileSystemPickerResult<T> => {
  const [isOpen, setIsOpen] = useState(false);
  const attemptRef = useRef<Attempt<T> | undefined>(undefined);
  const cancel = useCallback(() => {
    const attempt = attemptRef.current;
    attemptRef.current = undefined;
    attempt?.controller.abort();
    attempt?.resolve(undefined);
  }, []);
  useEffect(() => cancel, [cancel]);
  const pickFromFileSystem = useCallback(() => {
    cancel();
    setIsOpen(true);
    return new Promise<T[] | undefined>((resolve) => {
      attemptRef.current = {
        controller: new AbortController(),
        resolve,
        attaching: false,
      };
    });
  }, [cancel]);
  const handleClose = useCallback(() => {
    cancel();
    setIsOpen(false);
  }, [cancel]);
  const handleAttach = useCallback(
    (result: AttachResult) => {
      const attempt = attemptRef.current;
      if (!attempt || attempt.attaching) return;
      attempt.attaching = true;
      setIsOpen(false);
      const load = async () => {
        try {
          const entries = await Promise.all(
            result.files
              .filter((file) => file.nodeType === DialFileNodeType.ITEM)
              .map((file) => materializeFile(file, attempt.controller.signal)),
          );
          if (attemptRef.current !== attempt) return;
          attemptRef.current = undefined;
          attempt.resolve(entries);
        } catch (error) {
          if (attemptRef.current !== attempt) return;
          cancel();
          onError(error);
        }
      };
      void load();
    },
    [materializeFile, onError, cancel],
  );
  return { isOpen, pickFromFileSystem, handleAttach, handleClose };
};
