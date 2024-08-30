import { IconExclamationCircle } from '@tabler/icons-react';
import { FC } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ChatInputFooter } from '@/src/components/Chat/common/ChatInputFooter';
import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';

interface NotAllowedModelProps {
  isChatFullWidth: boolean;
  type: EntityType | null;
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
}

export const NotAllowedModel: FC<NotAllowedModelProps> = ({
  isChatFullWidth,
  type = EntityType.Model,
  showScrollDownButton,
  onScrollDownClick,
}) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div
      className={classNames(
        'flex w-full flex-col items-center justify-center p-2 md:px-4 lg:px-6',
        { 'lg:pl-20 lg:pr-[84px]': isChatFullWidth },
      )}
    >
      <div
        className={classNames(
          'relative flex w-full items-center gap-2 rounded bg-error p-4 text-base text-error',
          { 'lg:max-w-3xl': !isChatFullWidth },
        )}
        data-qa="not-allowed-model-error"
      >
        <IconExclamationCircle size={24} />
        <span> {t('chat.error.incorrect-selected', { context: type })}</span>
        {showScrollDownButton && (
          <ScrollDownButton
            className="-top-16 right-0 text-primary md:-top-20"
            onScrollDownClick={onScrollDownClick}
          />
        )}
      </div>
      <ChatInputFooter />
    </div>
  );
};
