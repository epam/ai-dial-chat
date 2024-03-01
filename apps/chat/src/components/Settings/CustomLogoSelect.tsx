import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FileManagerModal } from '../Files/FileManagerModal';

interface CustomLogoSelectProps {
  localLogo?: string;
  setLocalLogoFile: (file: DialFile | undefined) => void;
  files: DialFile[];
}

export const CustomLogoSelect = ({
  localLogo,
  setLocalLogoFile,
  files,
}: CustomLogoSelectProps) => {
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const { t } = useTranslation(Translation.Settings);
  const maximumAttachmentsAmount = 1;

  const onLogoSelect = (filesIds: string[]) => {
    const selectedFileId = filesIds[0];
    const newFile = files.find((file) => file.id === selectedFileId);
    setLocalLogoFile(newFile);
  };

  const onClickHandler = () => {
    setIsSelectFilesDialogOpened(true);
  };

  return (
    <div className="flex items-center gap-5">
      <div className="basis-1/3 md:basis-1/4">{t('Custom logo')}</div>
      <div className="flex h-[38px] max-w-[331px] grow  items-center gap-8 overflow-hidden rounded border border-primary px-3 focus-within:border-accent-primary focus:border-accent-primary">
        <div
          className={classNames(
            'block w-full max-w-full truncate',
            localLogo ? 'text-primary' : 'text-secondary',
          )}
        >
          {localLogo ? localLogo : t('No custom logo')}
        </div>
        <button onClick={onClickHandler} className="text-accent-primary">
          {localLogo ? t('Change') : t('Add')}
        </button>
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
        />
      )}
    </div>
  );
};
