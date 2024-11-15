import { IconTrash } from '@tabler/icons-react';
import { MouseEvent, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { FileManagerModal } from '../Files/FileManagerModal';

interface CustomLogoSelectProps {
  localLogo?: string;
  onLogoSelect: (filesIds: string[]) => void;
  onDeleteLocalLogoHandler: () => void;
  customPlaceholder?: string | null;
  title?: string | null;
  className?: string;
  fileManagerModalTitle?: string;
  allowedTypes?: string[];
}

export const CustomLogoSelect = ({
  localLogo,
  onLogoSelect,
  onDeleteLocalLogoHandler,
  customPlaceholder,
  title,
  className,
  fileManagerModalTitle,
  allowedTypes,
}: CustomLogoSelectProps) => {
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const { t } = useTranslation(Translation.Settings);
  const maximumAttachmentsAmount = 1;

  const onClickAddHandler = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsSelectFilesDialogOpened(true);
  };

  return (
    <div className="flex items-center gap-5">
      {title && <div className="basis-1/3 md:basis-1/4">{t(title)}</div>}
      <div
        className={classNames(
          'flex h-[38px] max-w-[331px] grow basis-2/3 items-center gap-8 overflow-hidden rounded border border-primary px-3 focus-within:border-accent-primary hover:border-accent-primary focus:border-accent-primary md:basis-3/4',
          className,
        )}
      >
        <div
          className={classNames(
            'block w-full max-w-full truncate',
            localLogo ? 'text-primary' : 'text-secondary',
          )}
        >
          {localLogo ?? customPlaceholder ?? t('No custom logo')}
        </div>
        <div className="flex gap-3">
          <button onClick={onClickAddHandler} className="text-accent-primary">
            {localLogo ? t('Change') : t('Add')}
          </button>
          {localLogo && (
            <button
              onClick={onDeleteLocalLogoHandler}
              className="text-secondary hover:text-error"
            >
              <IconTrash size={18} />
            </button>
          )}
        </div>
      </div>
      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={allowedTypes ?? ['image/*']}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={(files: unknown) => {
            if ((files as string[]).length > 0) {
              onLogoSelect(files as string[]);
            }
            setIsSelectFilesDialogOpened(false);
          }}
          headerLabel={fileManagerModalTitle || t('Select custom logo')}
          customButtonLabel={t('Select file') as string}
          customUploadButtonLabel={t('Upload files') as string}
          forceShowSelectCheckBox
        />
      )}
    </div>
  );
};
