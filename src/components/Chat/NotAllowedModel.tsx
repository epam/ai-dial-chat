import { useTranslation } from 'next-i18next';

import { EntityType } from '@/src/types/common';

export const NotAllowedModel = ({ type = EntityType.Model }) => {
  const { t } = useTranslation('chat');

  return (
    <div className="absolute bottom-0 flex w-full items-center justify-center rounded bg-red-200 px-10 py-8 text-center text-base text-red-800 dark:bg-red-900 dark:text-red-400">
      <span>{t('chat.error.incorrect-selected', { context: type })}</span>
    </div>
  );
};
