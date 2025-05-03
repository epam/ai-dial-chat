import { DragEvent, ReactNode, useCallback, useState } from 'react';

import classNames from 'classnames';

import { getFileNameExtension } from '@/src/utils/app/file';

interface FileDropAreaProps {
  children: ReactNode;
  onDrop: (files: File[]) => void;
  droppable?: boolean;
  className?: string;
}

export const FileDropArea = ({
  children,
  droppable = true,
  className,
  onDrop,
}: FileDropAreaProps) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes('Files')) {
      return;
    }
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (droppable) {
        const files = Array.from(e.dataTransfer?.files ?? []).filter(
          (f) => !!getFileNameExtension(f.name),
        );

        if (files.length) onDrop(files);
      }
    },
    [droppable, onDrop],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={classNames('relative', className)}
    >
      {isDraggingOver && (
        <div
          onDragLeave={handleDragLeave}
          className={classNames(
            'absolute z-50 flex size-full items-start justify-center bg-accent-primary-alpha pt-[100px]',
            droppable ? 'cursor-copy' : 'cursor-not-allowed',
          )}
        >
          <h1 className="text-lg font-bold text-primary">
            {droppable
              ? 'Drop items here'
              : 'This conversation does not support attachments'}
          </h1>
        </div>
      )}
      {children}
    </div>
  );
};
