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
      const files = e.clipboardData
        ? getFilesFromDataTransferItems(e.clipboardData.items)
        : [];

      if (!files.length) return;
      e.preventDefault();

      onPaste(files);
    };

    element.addEventListener('paste', pasteHandler);

    return () => element?.removeEventListener('paste', pasteHandler);
  }, [element, onPaste]);
}
