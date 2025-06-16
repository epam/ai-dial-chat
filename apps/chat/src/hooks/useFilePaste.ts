import { RefObject, useEffect } from 'react';

import { getFilesFromDataTransferItems } from '@/src/utils/app/file';

export function useFilePaste<T extends HTMLElement = HTMLElement>(
  container: RefObject<T>,
  onPaste: (files: File[]) => void,
) {
  const element = container.current;

  useEffect(() => {
    if (!element) return;

    const pasteHandler = (e: ClipboardEvent) => {
      const transferFiles = e.clipboardData
        ? getFilesFromDataTransferItems(e.clipboardData.items)
        : [];
      const files = Array.from(e.clipboardData?.files ?? []);

      if (!transferFiles.length && !files.length) return;
      e.preventDefault();

      onPaste(transferFiles.length ? transferFiles : files);
    };

    element.addEventListener('paste', pasteHandler);

    return () => element?.removeEventListener('paste', pasteHandler);
  }, [element, onPaste]);
}
