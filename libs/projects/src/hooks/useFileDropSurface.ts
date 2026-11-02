import type { DragEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

/** React drag-event handlers to spread onto the drop surface. */
interface FileDropSurfaceHandlers {
  /** Attach to the surface's `onDragEnter`. */
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  /** Attach to the surface's `onDragLeave`. */
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  /** Attach to the surface's `onDragOver`. */
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  /** Attach to the surface's `onDrop`. */
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

/** State and handlers returned by `useFileDropSurface`. */
interface FileDropSurfaceState {
  /** Whether a file-bearing drag is over the surface. */
  isDragActive: boolean;
  /** Handlers to spread onto the surface element. */
  handlers: FileDropSurfaceHandlers;
}

const isFileDrag = (event: DragEvent<HTMLElement>): boolean =>
  !!event.dataTransfer?.types.includes('Files');

/**
 * Drag-and-drop state for a whole form surface, so files dropped anywhere on
 * the New project form are added, not only those dropped on its drop zone.
 * Uses nested enter/leave counting like the skill editor's
 * `useSkillFileDropZone`, which is not exported from its lib.
 */
export const useFileDropSurface = (
  onFilesDropped: (files: File[]) => void,
): FileDropSurfaceState => {
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
    handlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
  };
};
