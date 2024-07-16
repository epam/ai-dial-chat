import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { FileManagerModal } from '../Files/FileManagerModal';

interface CustomLogoSelectProps {
  localLogo?: string;
  onLogoSelect: (filesIds: string[]) => void;
  onDeleteLocalLogoHandler: () => void;
  customPlaceholder?: string;
  hasLeftText?: boolean;
  className?: string;
}

export const CustomLogoSelect = ({
  localLogo,
  onLogoSelect,
  onDeleteLocalLogoHandler,
  customPlaceholder,
  hasLeftText = true,
  className,
}: CustomLogoSelectProps) => {
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const { t } = useTranslation(Translation.Settings);
  const maximumAttachmentsAmount = 1;

  const onClickAddHandler = () => {
    setIsSelectFilesDialogOpened(true);
  };

  return (
    <div className="flex items-center gap-5">
      {hasLeftText ? (
        <div className="basis-1/3 md:basis-1/4">{t('Custom logo')}</div>
      ) : (
        ''
      )}
      <div
        className={classNames(
          'flex h-[38px] max-w-[331px] grow  items-center gap-8 overflow-hidden rounded border border-primary px-3 focus-within:border-accent-primary focus:border-accent-primary',
          className,
        )}
      >
        <div
          className={classNames(
            'block w-full max-w-full truncate',
            localLogo ? 'text-primary' : 'text-secondary',
          )}
        >
          {localLogo
            ? localLogo
            : customPlaceholder
              ? customPlaceholder
              : t('No custom logo')}
        </div>
        <div className="flex gap-3">
          <button onClick={onClickAddHandler} className="text-accent-primary">
            {localLogo ? t('Change') : t('Add')}
          </button>
          {localLogo && (
            <button
              onClick={onDeleteLocalLogoHandler}
              className="text-accent-primary"
            >
              <IconTrash className="text-secondary" size={18} />
            </button>
          )}
        </div>
      </div>
      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={['image/*']}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={(files: unknown) => {
            onLogoSelect(files as string[]);
            setIsSelectFilesDialogOpened(false);
          }}
          headerLabel={t('Select custom logo')}
          customButtonLabel={t('Select file') as string}
          customUploadButtonLabel={t('Upload files') as string}
          forceShowSelectCheckBox
        />
      )}
    </div>
  );
};
