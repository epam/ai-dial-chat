import { IconExclamationCircle } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ChatInputFooter } from './ChatInput/ChatInputFooter';

export const NotAllowedModel = ({ type = EntityType.Model }) => {
  const { t } = useTranslation(Translation.Chat);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  return (
    <div
      className={classNames(
        'flex w-full flex-col items-center justify-center pt-2',
        { 'lg:pl-20 lg:pr-[84px]': isChatFullWidth },
      )}
    >
      <div
        className={classNames(
          'flex w-full items-center gap-2 rounded bg-error p-4 text-base text-error',
          { 'lg:max-w-3xl': !isChatFullWidth },
        )}
        data-qa="not-allowed-model-error"
      >
        <IconExclamationCircle size={24} />
        <span> {t(`chat.error.incorrect_selected_${type}.text`)}</span>
      </div>
      <ChatInputFooter />
    </div>
  );
};
