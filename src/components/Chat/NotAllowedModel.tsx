import { useTranslation } from 'next-i18next';

export const NotAllowedModel = () => {
  const { t } = useTranslation('chat');

  return (
    <div className="absolute bottom-0 flex w-full items-center justify-center rounded bg-red-200 px-10 pb-10 text-center text-base text-red-800 dark:bg-red-900 dark:text-red-400">
      <span>
        {t('Not allowed model selected. Please, change the model to proceed')}
      </span>
    </div>
  );
};
