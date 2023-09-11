import { IconRefresh } from '@tabler/icons-react';
import { FC } from 'react';

import { useTranslation } from 'next-i18next';

interface Props {
  onRegenerate: () => void;
}

export const Regenerate: FC<Props> = ({ onRegenerate }) => {
  const { t } = useTranslation('chat');
  return (
    <div className="fixed inset-x-0 bottom-4 mx-auto w-full px-2 sm:absolute sm:bottom-8 sm:left-[280px] sm:w-1/2 lg:left-[200px]">
      <div className="mb-4 text-center text-red-400 dark:text-red-200">
        {t('Sorry, there was an error.')}
      </div>
      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded border border-gray-400 bg-gray-400 text-sm font-semibold text-gray-800 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-200"
        onClick={onRegenerate}
      >
        <IconRefresh />
        <div>{t('Regenerate response')}</div>
      </button>
    </div>
  );
};
