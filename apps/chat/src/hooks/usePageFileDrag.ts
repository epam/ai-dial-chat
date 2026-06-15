import { useCallback, useEffect, useRef, useState } from 'react';

interface PageFileDragState {
  isDragging: boolean;
  pendingFiles: File[];
  onFilesConsumed: () => void;
}

export const usePageFileDrag = (): PageFileDragState => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const enterCountRef = useRef(0);

  const onFilesConsumed = useCallback(() => {
    setPendingFiles([]);
  }, []);

  useEffect(() => {
    const isFileDrag = (e: DragEvent) =>
      !!e.dataTransfer?.types.includes('Files');

    const handleDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      enterCountRef.current += 1;
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      enterCountRef.current -= 1;
      if (enterCountRef.current <= 0) {
        enterCountRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      enterCountRef.current = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) {
        setPendingFiles(files);
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return { isDragging, pendingFiles, onFilesConsumed };
};
