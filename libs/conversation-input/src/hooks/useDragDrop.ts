import React, { useCallback, useRef, useState } from 'react';

/**
 * Tracks drag-and-drop interactions on a container element and extracts
 * dropped `File` objects, calling `onFiles` when a drop occurs.
 *
 * Uses a depth counter (ref, not state) to handle nested drag-enter/leave
 * events correctly without causing extra renders.
 */
export const useDragDrop = (
  onFiles: (files: File[]) => void,
): {
  dragHandlers: {
    onDragEnter: React.DragEventHandler;
    onDragLeave: React.DragEventHandler;
    onDragOver: React.DragEventHandler;
    onDrop: React.DragEventHandler;
  };
  isDragOver: boolean;
} => {
  const depthRef = useRef<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragEnter: React.DragEventHandler = useCallback((event) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    depthRef.current += 1;
    setIsDragOver(true);
  }, []);

  const onDragLeave: React.DragEventHandler = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const onDragOver: React.DragEventHandler = useCallback((event) => {
    event.preventDefault();
  }, []);

  const onDrop: React.DragEventHandler = useCallback(
    (event) => {
      event.preventDefault();
      depthRef.current = 0;
      setIsDragOver(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        onFiles(files);
      }
    },
    [onFiles],
  );

  return {
    dragHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
    isDragOver,
  };
};
