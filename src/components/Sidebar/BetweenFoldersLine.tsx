import { useCallback, useRef, useState } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { HighlightColor } from '@/src/types/common';
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
  highlightColor: HighlightColor;
}

export const BetweenFoldersLine = ({
  level,
  index,
  parentFolderId,
  highlightColor,
  onDrop,
  onDraggingOver,
}: BetweenFoldersLineProps) => {
  const dragDropElement = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const dropHandler = useCallback(
    (e: any) => {
      if (!e.dataTransfer) {
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
    [index, onDrop, parentFolderId],
  );

  const allowDrop = useCallback((e: any) => {
    e.preventDefault();
  }, []);

  const highlightDrop = useCallback(() => {
    setIsDraggingOver(true);
    onDraggingOver?.(true);
  }, [onDraggingOver]);

  const removeHighlight = useCallback(() => {
    setIsDraggingOver(false);
    onDraggingOver?.(false);
  }, [onDraggingOver]);

  const highlightColorBg = getByHighlightColor(
    highlightColor,
    classNames('bg-green/60'),
    classNames('bg-violet/60'),
    classNames('bg-blue-500/60'),
  );

  return (
    <div
      onDrop={dropHandler}
      onDragOver={allowDrop}
      onDragEnter={highlightDrop}
      onDragLeave={removeHighlight}
      ref={dragDropElement}
      className={classNames('h-1', isDraggingOver && highlightColorBg)}
      style={{
        marginLeft: (level && `${level * 24}px`) || 0,
      }}
    ></div>
  );
};
