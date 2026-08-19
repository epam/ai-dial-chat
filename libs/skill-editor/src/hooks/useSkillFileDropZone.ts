import type { DragEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

/** React drag-event handlers to spread onto a drop-zone element. */
export interface SkillFileDropZoneHandlers {
  /** Attach to the drop-zone element's `onDragEnter`. */
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  /** Attach to the drop-zone element's `onDragLeave`. */
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  /** Attach to the drop-zone element's `onDragOver`. */
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  /** Attach to the drop-zone element's `onDrop`. */
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

/** State and handlers returned by `useSkillFileDropZone`. */
export interface SkillFileDropZoneState {
  /** Whether a file-bearing drag is currently over the drop zone. */
  isDragActive: boolean;
  /** Handlers to spread onto the drop-zone element. */
  dropZoneHandlers: SkillFileDropZoneHandlers;
}

const isFileDrag = (event: DragEvent<HTMLElement>): boolean =>
  !!event.dataTransfer?.types.includes('Files');

/**
 * Scoped drag-and-drop state for a single drop-zone element, using the same
 * nested-enter/leave counting technique as the app's page-wide
 * `usePageFileDrag`, but attached directly to the element's own React drag
 * events instead of `document` listeners.
 */
export const useSkillFileDropZone = (
  onFilesDropped: (files: File[]) => void,
): SkillFileDropZoneState => {
  const [isDragActive, setIsDragActive] = useState(false);
  const enterCountRef = useRef(0);

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    enterCountRef.current += 1;
    setIsDragActive(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    enterCountRef.current -= 1;
    if (enterCountRef.current <= 0) {
      enterCountRef.current = 0;
      setIsDragActive(false);
    }
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      enterCountRef.current = 0;
      setIsDragActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) onFilesDropped(files);
    },
    [onFilesDropped],
  );

  return {
    isDragActive,
    dropZoneHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
  };
};
