import { DragEvent, useCallback, useRef, useState } from 'react';

import classNames from 'classnames';

import {
  getFolderMoveType,
  hasDragEventFolderData,
} from '@/src/utils/app/move';

import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';

interface BetweenFoldersLineProps {
  level: number;
  onDrop: (folderData: FolderInterface) => void;
  onDraggingOver?: (isDraggingOver: boolean) => void;
  featureType: FeatureType;
  denyDrop?: boolean;
}

export const BetweenFoldersLine = ({
  level,
  onDrop,
  onDraggingOver,
  featureType,
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

      const folderData = e.dataTransfer.getData(getFolderMoveType(featureType));

      if (folderData) {
        onDrop(JSON.parse(folderData));
      }
    },
    [denyDrop, featureType, onDrop],
  );

  const allowDrop = useCallback(
    (e: DragEvent) => {
      if (!denyDrop && hasDragEventFolderData(e, featureType)) {
        e.preventDefault();
      }
    },
    [denyDrop, featureType],
  );

  const highlightDrop = useCallback(
    (e: DragEvent) => {
      if (denyDrop || !hasDragEventFolderData(e, featureType)) {
        return;
      }
      setIsDraggingOver(true);
      onDraggingOver?.(true);
    },
    [denyDrop, featureType, onDraggingOver],
  );

  const deleteHighlight = useCallback(() => {
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
      onDragLeave={deleteHighlight}
      ref={dragDropElement}
      className={classNames('h-1', isDraggingOver && 'bg-accent-primary-alpha')}
      style={{
        marginLeft: (level && `${level * 24}px`) || 0,
      }}
    ></div>
  );
};
