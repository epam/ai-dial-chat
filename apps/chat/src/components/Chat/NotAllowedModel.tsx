import { IconExclamationCircle } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';

import { Conversation } from '@epam/ai-dial-shared';

interface Props {
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onShowChangeModel: (conversationId: string) => void;
  conversation: Conversation;
}

export const NotAllowedModel: React.FC<Props> = ({
  showScrollDownButton,
  onScrollDownClick,
  onShowChangeModel,
  conversation,
}) => {
  const { t } = useTranslation(Translation.Chat);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  const message = t('chat.error.agent-not-available', {
    agentId: conversation?.model.id,
    click: '__CLICK__',
  });

  const [prefix, suffix] = useMemo(() => {
    return message.split('__CLICK__');
  }, [message]);

  const handleOpenChangeModel = useCallback(
    () => onShowChangeModel(conversation.id),
    [conversation.id, onShowChangeModel],
  );

  return (
    <div
      className={classNames(
        'flex w-full flex-col items-center justify-center p-2 md:px-4 lg:px-6',
        { 'lg:pl-20 lg:pr-[84px]': isChatFullWidth },
      )}
    >
      <div
        className={classNames(
          'relative flex w-full items-center gap-2 rounded border border-error bg-error p-3 text-sm',
          { 'lg:max-w-3xl': !isChatFullWidth },
        )}
        data-qa="not-allowed-model-error"
      >
        <IconExclamationCircle
          size={24}
          className="mt-0.5 shrink-0 text-error"
        />
        <span className="flex flex-wrap items-start gap-x-1 break-words">
          <span>{prefix}</span>
          <button
            onClick={handleOpenChangeModel}
            className="underline underline-offset-2"
          >
            {t('change the agent')}
          </button>
          <span>{suffix}</span>
        </span>
        {showScrollDownButton && (
          <ScrollDownButton
            className="-top-16 right-0 text-primary md:-top-20"
            onScrollDownClick={onScrollDownClick}
          />
        )}
      </div>
    </div>
  );
};
