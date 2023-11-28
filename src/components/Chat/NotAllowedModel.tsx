import { IconExclamationCircle } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ChatInputFooter } from './ChatInput/ChatInputFooter';

export const NotAllowedModel = ({ type = EntityType.Model }) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="absolute bottom-0 flex w-full flex-col items-center justify-center">
      <div className="flex w-full items-center gap-2 rounded bg-red-200 p-4 text-base text-red-800 dark:bg-red-900 dark:text-red-400 lg:max-w-3xl">
        <IconExclamationCircle size={24} />
        <span> {t('chat.error.incorrect-selected', { context: type })}</span>
      </div>
      <ChatInputFooter />
    </div>
  );
};
