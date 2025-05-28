import { IconFileTextFilled, IconFileXFilled } from '@tabler/icons-react';
import { DragEvent, ReactNode, useCallback, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getFilesFromDataTransferItems } from '@/src/utils/app/file';

import { Translation } from '@/src/types/translation';

const containerId = 'file-drop-area';

interface FileDropAreaProps {
  children: ReactNode;
  onDrop: (files: File[]) => void;
  droppable?: boolean;
  disabled?: boolean;
  className?: string;
}

export const FileDropArea = ({
  children,
  droppable = true,
  disabled = false,
  className,
  onDrop,
}: FileDropAreaProps) => {
  const { t } = useTranslation(Translation.Files);

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      const isModalOverlayOpened = (e.target as HTMLElement)?.closest(
        '[data-floating-overlay]',
      );

      if (
        disabled ||
        !e.dataTransfer?.types?.includes('Files') ||
        isModalOverlayOpened
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    },
    [disabled],
  );

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
        const files = getFilesFromDataTransferItems(e.dataTransfer.items);

        if (files.length) onDrop(files);
      }
    },
    [droppable, onDrop],
  );

  // reset drag state if drag leave or drag over events were not emitted
  const handleResetDragOver = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  return (
    <div
      id={containerId}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={classNames('relative', className)}
    >
      {isDraggingOver && (
        <div
          className={classNames(
            'absolute z-10 flex size-full items-center justify-center bg-overlay backdrop-blur-sm',
          )}
        >
          <div
            className={classNames(
              'absolute z-10 size-full',
              droppable ? 'cursor-copy' : 'cursor-not-allowed',
            )}
            onDragLeave={handleDragLeave}
            onBlur={handleResetDragOver}
            onFocus={handleResetDragOver}
            onMouseLeave={handleResetDragOver}
          />
          <div className="flex flex-col items-center">
            {droppable ? (
              <>
                <IconFileTextFilled
                  size="100px"
                  className="mb-5 text-accent-primary"
                />
                <h5 className="mb-4 text-lg font-semibold text-primary">
                  {t('Attach files')}
                </h5>
                <p className="text-sm text-primary">
                  {t('Drop files here to attach them to the message')}
                </p>
              </>
            ) : (
              <>
                <IconFileXFilled size="100px" className="mb-5 text-error" />
                <h5 className="mb-4 text-lg font-semibold text-primary">
                  {t('No attachments allowed')}
                </h5>
                <p className="text-sm text-primary">
                  {t("Attachments can't be added to the message")}
                </p>
              </>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
