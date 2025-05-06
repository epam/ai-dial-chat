import { IconFileFilled, IconFileXFilled } from '@tabler/icons-react';
import { DragEvent, ReactNode, useCallback, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getFileNameExtension } from '@/src/utils/app/file';

import { Translation } from '@/src/types/translation';

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
  const { t } = useTranslation(Translation.Files);

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
            'absolute z-50 flex size-full items-center justify-center bg-overlay backdrop-blur-sm',
            droppable ? 'cursor-copy' : 'cursor-not-allowed',
          )}
        >
          <div className="flex flex-col items-center">
            {droppable ? (
              <>
                <IconFileFilled
                  size="100px"
                  className="mb-5 text-accent-primary"
                />
                <h5 className="mb-4 text-lg font-semibold text-primary">
                  {t('Attach files')}
                </h5>
                <p className="text-sm text-primary">
                  {t('Drop files here to attach them to message')}
                </p>
              </>
            ) : (
              <>
                <IconFileXFilled size="100px" className="mb-5 text-error" />
                <h5 className="mb-4 text-lg font-semibold text-primary">
                  {t('No attachments allowed')}
                </h5>
                <p className="text-sm text-primary">
                  {t("Attachments can't be added to conversation")}
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
