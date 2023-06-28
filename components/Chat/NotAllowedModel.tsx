import { useTranslation } from 'next-i18next';

export const NotAllowedModel = () => {
  const { t } = useTranslation('chat');

  return (
    <div className="flex item-center justify-center absolute bottom-0 w-full text-red-400 text-base border-transparent bg-gradient-to-b from-transparent via-white to-white pb-10 dark:border-white/20 dark:via-[#343541] dark:to-[#343541] px-10 text-center">
      <span>
        {t(
          'Not allowed model selected. Please, change the model to type a message',
        )}
      </span>
    </div>
  );
};
