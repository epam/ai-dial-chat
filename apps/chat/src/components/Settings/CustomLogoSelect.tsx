import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface CustomLogoSelectProps {
  localLogo?: string;
  setOpenFilesModal: (isOpen: boolean) => void;
}

export const CustomLogoSelect = ({
  localLogo,
  setOpenFilesModal,
}: CustomLogoSelectProps) => {
  const { t } = useTranslation(Translation.Settings);

  const onClickHandler = () => {
    setOpenFilesModal(true);
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
    </div>
  );
};
