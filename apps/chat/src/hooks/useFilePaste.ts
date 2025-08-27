import { RefObject, useEffect } from 'react';

import { getFilesFromDataTransferItems } from '@/src/utils/app/file';

export function useFilePaste<T extends HTMLElement = HTMLElement>(
  container: RefObject<T>,
  onPaste: (
    files: File[],
    textContent?: string,
    selection?: { start: number; end: number },
  ) => void,
) {
  const element = container.current;

  useEffect(() => {
    if (!element) return;

    const pasteHandler = (e: ClipboardEvent) => {
      const transferFiles = e.clipboardData
        ? getFilesFromDataTransferItems(e.clipboardData.items)
        : [];
      const files = Array.from(e.clipboardData?.files ?? []);

      const textContent = e.clipboardData?.getData('text/plain');

      const target = e.target as HTMLInputElement | null;

      const selection =
        target &&
        target?.selectionStart !== null &&
        target?.selectionEnd !== null
          ? {
              start: target.selectionStart,
              end: target.selectionEnd,
            }
          : undefined;

      if (!transferFiles.length && !files.length) return;
      e.preventDefault();

      onPaste(
        transferFiles.length ? transferFiles : files,
        textContent,
        selection,
      );
    };

    element.addEventListener('paste', pasteHandler);

    return () => element?.removeEventListener('paste', pasteHandler);
  }, [element, onPaste]);
}
