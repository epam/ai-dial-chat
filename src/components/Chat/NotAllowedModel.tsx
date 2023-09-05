import { useTranslation } from 'next-i18next';

export const NotAllowedModel = () => {
  const { t } = useTranslation('chat');

  return (
    <div className="item-center absolute bottom-0 flex w-full justify-center border-transparent bg-gradient-to-b from-transparent via-white to-white px-10 pb-10 text-center text-base text-red-400 dark:border-white/20 dark:via-[#343541] dark:to-[#343541]">
      <span>
        {t(
          'Not allowed model selected. Please, change the model to type a message',
        )}
      </span>
    </div>
  );
};
