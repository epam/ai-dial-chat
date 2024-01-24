import { DragEvent, useCallback, useRef, useState } from 'react';

import classNames from 'classnames';

import { FolderInterface } from '@/src/types/folder';

interface BetweenFoldersLineProps {
  level: number;
  index: number;
  parentFolderId: string | undefined;
  onDrop: (
    folderData: FolderInterface,
    parentFolderId: string | undefined,
    index: number,
  ) => void;
  onDraggingOver?: (isDraggingOver: boolean) => void;
  denyDrop?: boolean;
}

export const BetweenFoldersLine = ({
  level,
  index,
  parentFolderId,
  onDrop,
  onDraggingOver,
  denyDrop,
}: BetweenFoldersLineProps) => {
  const dragDropElement = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const dropHandler = useCallback(
    (e: DragEvent) => {
      if (!e.dataTransfer || denyDrop) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      setIsDraggingOver(false);

      const folderData = e.dataTransfer.getData('folder');

      if (folderData) {
        onDrop(JSON.parse(folderData), parentFolderId, index);
      }
    },
    [denyDrop, index, onDrop, parentFolderId],
  );

  const allowDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const highlightDrop = useCallback(() => {
    if (denyDrop) {
      return;
    }
    setIsDraggingOver(true);
    onDraggingOver?.(true);
  }, [denyDrop, onDraggingOver]);

  const removeHighlight = useCallback(() => {
    if (denyDrop) {
      return;
    }
    setIsDraggingOver(false);
    onDraggingOver?.(false);
  }, [denyDrop, onDraggingOver]);

  return (
    <div
      onDrop={dropHandler}
      onDragOver={allowDrop}
      onDragEnter={highlightDrop}
      onDragLeave={removeHighlight}
      ref={dragDropElement}
      className={classNames('h-1', isDraggingOver && 'bg-accent-primary-alpha')}
      style={{
        marginLeft: (level && `${level * 24}px`) || 0,
      }}
    ></div>
  );
};
