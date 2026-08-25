import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** Return value of {@link usePageFileDrag}. */
export interface UsePageFileDragResult {
  /** Whether a file drag is currently over the page. */
  isDragging: boolean;
  /** Files dropped on the page, pending consumption by the caller. */
  pendingFiles: File[];
  /** Clears `pendingFiles` after the caller has processed them. */
  onFilesConsumed: () => void;
}

/**
 * Detects files being dragged over the whole page and exposes the dropped
 * files, using only `document`-level drag events with an enter/leave
 * counter to avoid flicker from child-element boundary crossings.
 */
export const usePageFileDrag = (
  isAttachmentsAllowed = true,
  isEnabled = true,
): UsePageFileDragResult => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const enterCountRef = useRef(0);
  const isAttachmentsAllowedRef = useRef(isAttachmentsAllowed);
  const isEnabledRef = useRef(isEnabled);

  useLayoutEffect(() => {
    isAttachmentsAllowedRef.current = isAttachmentsAllowed;
    isEnabledRef.current = isEnabled;
    if (!isEnabled) {
      enterCountRef.current = 0;
      setIsDragging(false);
    }
  }, [isAttachmentsAllowed, isEnabled]);

  const onFilesConsumed = useCallback(() => {
    setPendingFiles([]);
  }, []);

  useEffect(() => {
    const isFileDrag = (e: DragEvent) =>
      !!e.dataTransfer?.types.includes('Files');

    const handleDragEnter = (e: DragEvent) => {
      if (!isEnabledRef.current || !isFileDrag(e)) return;
      enterCountRef.current += 1;
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!isEnabledRef.current || !isFileDrag(e)) return;
      enterCountRef.current -= 1;
      if (enterCountRef.current <= 0) {
        enterCountRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      if (!isEnabledRef.current) return;
    };

    const handleDrop = (e: DragEvent) => {
      if (!isFileDrag(e) || !isEnabledRef.current) return;
      e.preventDefault();
      enterCountRef.current = 0;
      setIsDragging(false);
      if (isAttachmentsAllowedRef.current) {
        const files = Array.from(e.dataTransfer?.files ?? []);
        if (files.length > 0) {
          setPendingFiles(files);
        }
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
