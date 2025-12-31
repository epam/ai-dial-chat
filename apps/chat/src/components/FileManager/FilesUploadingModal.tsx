import { useCallback, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { UploadStatus } from '@epam/ai-dial-shared';
import {
  ButtonVariant,
  DialButton,
  DialFileName,
  DialPopup,
} from '@epam/ai-dial-ui-kit';

export interface FilesUploadingModalOptions {
  title: string;
  text: string;
  onCancel?: () => void;
  files: {
    id: string;
    name: string;
    status: UploadStatus;
    percent?: number;
    error?: string;
  }[];
}

export const FilesUploadingModal = ({
  files,
  text,
  title,
  onCancel,
}: FilesUploadingModalOptions) => {
  const { t } = useTranslation(Translation.Common);
  const [isOpen, setIsOpen] = useState(true);

  const renderDetails = useCallback((percent?: number) => {
    if (percent === undefined) return null;

    return (
      <div className="h-1 w-full overflow-hidden rounded-full bg-layer-1">
        <div
          className="h-full rounded-full bg-accent-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }, []);

  return (
    <DialPopup
      className="!h-fit !max-h-full !w-[400px] md:!max-h-[693px]"
      open={isOpen}
      dividers={false}
      onClose={() => setIsOpen(false)}
      closeOnOutsideClick={false}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4">
          <DialButton
            variant={ButtonVariant.Secondary}
            label={t('Cancel')}
            onClick={() => {
              setIsOpen(false);
              onCancel?.();
            }}
          />
        </div>
      }
      header={
        <div className="flex flex-col gap-2">
          <div>{title}</div>
          <div className="text-sm text-secondary">{text}</div>
        </div>
      }
    >
      <div className="flex h-full max-h-full flex-col gap-4 px-6">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {files.map((file) => (
            <div key={file.name} className="rounded bg-layer-2 px-3 py-2">
              <DialFileName
                name={file.name}
                details={renderDetails(file.percent)}
              />
            </div>
          ))}
        </div>
      </div>
    </DialPopup>
  );
};
