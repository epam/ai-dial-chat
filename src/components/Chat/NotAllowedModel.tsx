import { IconExclamationCircle } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ChatInputFooter } from './ChatInput/ChatInputFooter';

export const NotAllowedModel = ({ type = EntityType.Model }) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="absolute bottom-0 flex w-full flex-col items-center justify-center">
      <div
        className="flex w-full items-center gap-2 rounded bg-error p-4 text-base text-error lg:max-w-3xl"
        data-qa="not-allowed-model-error"
      >
        <IconExclamationCircle size={24} />
        <span> {t('chat.error.incorrect-selected', { context: type })}</span>
      </div>
      <ChatInputFooter />
    </div>
  );
};
